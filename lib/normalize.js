'use strict';

const Clone = require('@liqd-js/clone');

const NORMALIZERS = [ '_type', '_any', '_requires', '_passes', '_unset', '_each', '_convert', '_expand', '_default', '_required', '_strict' ];

// _prohibited, _unset, _getter

class NormalizerError extends Error
{
	constructor( errors )
	{
		super( 'Normalizer Error' );

		Error.captureStackTrace && Error.captureStackTrace( this, NormalizerError );

		this.errors = errors;
	}
}

const ARR = arr => Array.isArray( arr ) ? arr : [ arr ];

function path_str( path )
{
	return path.map( p => p.toString().includes('.') ? '[' + p + ']' : p ).join('.').replace(/\.\[/g,'[');  // TODO [foo[bar]] 
}

function path_from_str( str, current )
{
	let relative = str.match(/^\.*/)[0]
	let path = [ ...str.substr( relative.length ).matchAll(/(?<=^|\.)[^.\[]+|(?<=^|\[)[^\]]+(?=\])/g)].map( p => p[0] );

	if( relative.length )
	{
		path = [ ...current.slice( 0, current.length - relative.length ), ...path ];
	}

	return path;
}

function has( root, path )
{
	let obj = root, i;

	for( i = 0; obj && i < path.length - 1; ++i )
	{
		obj = obj[path[i]];
	}

	return Boolean( obj && typeof obj === 'object' && obj.hasOwnProperty( path[ path.length - 1 ]));
}

function get( root, path )
{
	let obj = root, i;

	for( i = 0; obj && i < path.length; ++i )
	{
		obj = obj[path[i]];
	}

	return i === path.length ? obj : undefined;
}

function normalize_value( parent, property, value, root, path, errors, schema, options )
{
	for( let normalizer in schema )
	{
		if( !NORMALIZERS.includes( normalizer )){ continue }
			
		if( '_type' === normalizer )
		{
			if( !ARR( schema._type ).includes( typeof value ))
			{
				errors[ path_str( path )] = 'invalid_type'; break;
			}
		}
		else if( '_any' === normalizer )
		{
			if( !ARR( schema._any ).includes( value ))
			{
				errors[ path_str( path )] = 'invalid_value'; break;
			}
		}
		else if( '_requires' === normalizer )
		{
			if( !has( root, path_from_str( schema._requires, path )))
			{
				errors[ path_str( path )] = 'missing_requirement'; break;
			}
		}
		else if( '_passes' === normalizer )
		{
			if( !schema._passes( value, { root, parent }))
			{
				errors[ path_str( path )] = 'invalid_value'; break;
			}
		}
		else if( '_unset' === normalizer )
		{
			if( schema._unset( value, { root, parent }))
			{
				delete parent[property]; break;
			}
		}
		else if( '_each' === normalizer )
		{
			if( Array.isArray( value ))
			{
				for( let i = 0; i < value.length; ++i )
				{
					value[i] = normalize_value( value, i, value[i], root, [ ...path, i ], errors, schema._each, options );
				}
			}
			else
			{
				for( let key in value )
				{
					value[key] = normalize_value( value, key, value[key], root, [ ...path, key ], errors, schema._each, options );
				}
			}
		}
		else if( '_convert' === normalizer )
		{
			value = parent[property] = schema._convert( value, { root, parent });
		}
	}

	if( value && typeof value === 'object' && !Array.isArray( value ))
	{
		value = normalize_object( value, root, path, errors, schema, options );
	}

	return value;
}

function normalize_object( obj, root, path, errors, schema, options )
{
	for( let property in obj )
	{
		if( !schema.hasOwnProperty( property ))
		{
			if( schema.hasOwnProperty('_strict') ? schema._strict : options.strict ){ delete obj[property] }

			continue;
		}
		
		obj[property] = normalize_value( obj, property, obj[property], root, [ ...path, property, ], errors, schema[property], options );

		if( obj[property] && typeof obj[property] === 'object' && !Array.isArray( obj[property] ))
		{
			normalize_object( obj[property], root, [ ...path, property ], errors, schema[property], options );
		}
	}

	for( let property in schema )
	{
		if( schema[property].hasOwnProperty( '_default' ) && !obj.hasOwnProperty( property ))
		{
			obj[property] = Clone( schema[property]._default );
		}
		else if( schema[property]._required && !obj.hasOwnProperty( property ))
		{
			errors[ path_str([ ...path, property ])] = 'required'; continue;
		}
		else if( schema[property]._expand )
		{
			obj[property] = normalize_object({}, root, [ ...path, property ], errors, schema[property], options );
		}
	}

	return obj;
}

module.exports = function normalize( input, schema, options = {})
{
	if( options.clone ){ input = Clone( input )}

	let errors = {};

	normalize_object( input, input, [], errors, schema, options );
	
	if( Object.keys( errors ).length ){ throw new NormalizerError( errors )}

	return input;
}
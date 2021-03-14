'use strict';

const Clone = require('@liqd-js/clone');

const NORMALIZERS = [ '_type', '_any', '_requires', '_passes', '_each', '_convert', '_expand', '_default', '_required' ];

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

function normalize_object( obj, root, path, errors, schema, options )
{
	for( let property in obj )
	{
		if( !schema.hasOwnProperty( property ))
		{
			if( options.strict ){ delete obj[property] }

			continue;
		}
		
		for( let normalizer in schema[property] )
		{
			if( !NORMALIZERS.includes( normalizer )){ continue }
				
			if( '_type' === normalizer )
			{
				if( !ARR( schema[property]._type ).includes( typeof obj[property] ))
				{
					errors[ path_str([ ...path, property ])] = 'invalid_type'; continue;
				}
			}
			else if( '_any' === normalizer )
			{
				if( !ARR( schema[property]._any ).includes( obj[property] ))
				{
					errors[ path_str([ ...path, property ])] = 'invalid_value'; continue;
				}
			}
			else if( '_requires' === normalizer )
			{
				if( !has( root, path_from_str( schema[property]._requires, [ ...path, property ])))
				{
					errors[ path_str([ ...path, property ])] = 'missing_requirement'; continue;
				}
			}
			else if( '_passes' === normalizer )
			{
				if( !schema[property]._passes( obj[property], { root, parent: obj }))
				{
					errors[ path_str([ ...path, property ])] = 'invalid_value'; continue;
				}
			}
			else if( '_each' === normalizer )
			{
				for( let i = 0; i < obj[property].length; ++i )
				{
					normalize_object( obj[property][i], root, [ ...path, property, i ], errors, schema[property]._each, options );
				}
			}
			else if( '_convert' === normalizer )
			{
				obj[property] = schema[property]._convert( obj[property], { root, parent: obj });
			}
		}

		if( obj[property] && typeof obj[property] === 'object' )
		{
			normalize_object( obj[property], root, [ ...path, property ], errors, schema[property], options );
		}
	}

	for( let property in schema )
	{
		if( !schema.hasOwnProperty( property )){ continue }

		if( schema[property]._default )
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
}

module.exports = function normalize( input, schema, options = {})
{
	if( options.clone ){ input = Clone( input )}

	let errors = {};

	normalize_object( input, input, [], errors, schema, options );
	
	if( Object.keys( errors ).length ){ throw new NormalizerError( errors )}

	return input;
}
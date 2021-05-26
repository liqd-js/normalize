const assert = require('assert' );

const Normalizer = require('../lib/normalize');

describe( 'Tests', () =>
{
	it('should validate normalizer', function()
	{
		assert.deepStrictEqual
		(
			Normalizer(
			{
				foo: 'bar',
				bar: 'foo',
				tests:
				{
					foo: 'foo',
					bar : 42,
					foobar: '256',
					barfoo: 11,
					over: true,
				},
				pass:
				{
					foo: 'bar',
					bar: false
				},
				missing:
				{

				},
				expandable: true,
				expandables: false,
				def: 42
			},
			{
				foo: { _required: false },
				def: 'foobar',
				fed: { _default: 'barfoo' },
				tests:
				{
					_required: true,
					foo: { _any: ['foo', 'bar'], _requires: '.bar' },
					bar: { _type: [ 'string', 'number' ] },
					foobar: { _type: 'string', _convert: parseInt },
					barfoo: { _passes: $ => 10 < $ && $ < 12 }
				},
				pass: { _required: true },
				missing:
				{
					foo: true,
					bar: { _default: 'foo', _requires: ['..tests.foo', 'foo'] },
					foobar: { _default: { foo: 'bar' } },
					barfoo: { _requires: 'foo' }
				},
				def: 64,
				fed: 48,
				expand :
				{
					_expand: true,

					foo: true,
					bar: { _default: 'foo' }
				},
				dont_expand:
				{
					foo: true,
					bar: { _default: 'foo' }
				},
				expandable:
				{
					_expand: true,

					foo: true,
					bar: { _default: 'foo' }
				},
				expandables:
				{
					_expand: true,

					foo: true,
					bar: { _default: 'foo' }
				}
			}),
			{
				foo: 'bar',
				def: 'foobar',
				fed: 'barfoo',
				tests:
				{
					foo: 'foo',
					bar : 42,
					foobar: 256,
					barfoo: 11
				},
				pass:
				{
					foo: 'bar',
					bar: false
				},
				missing:
				{
					foo: true,
					bar: 'foo',
					foobar:
					{
						foo: 'bar'
					}
				},
				def: 42,
				fed: 48,
				expand :
				{
					foo: true,
					bar: 'foo'
				},
				expandable :
				{
					foo: true,
					bar: 'foo'
				}
			}
		);
	});

	it('should fail - not object', function()
	{
		try
		{
			Normalizer({ foo: null }, { foo: { _required: true, bar: { _required: true }}});

			assert.fail();
		}
		catch(e){ console.log( 'ERR', e );  assert.equal( e.message, 'Invalid options: "foo" is of wrong type null, "object" is required' ); }
	});

	it('should fail - required', function()
	{
		try
		{
			Normalizer({ foo: {}}, { foo: { bar: { _required: true }}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "foo.bar" is required' ); }
	});

	it('should fail - type missmatch', function()
	{
		try
		{
			Normalizer({ foo: { bar: 'test' }}, { foo: { bar: { _type: 'number' }}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "foo.bar" is of wrong type "string", "number" is required' ); }
	});

	it('should fail - value missmatch', function()
	{
		try
		{
			Normalizer({ foo: { bar: 'test' }}, { foo: { bar: { _any: ['foo', 'bar'] }}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "foo.bar" is of wrong value "test", "foo" or "bar" is required' ); }
	});

	it('should fail - value does not pass', function()
	{
		try
		{
			Normalizer({ foo: { bar: 'test' }}, { foo: { bar: { _passes: $ => $ === 'foo' }}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "foo.bar" is of wrong value "test", ( $ => $ === \'foo\' ) is required' ); }
	});

	it('should fail - requirements not met', function()
	{
		try
		{
			Normalizer({ foo: { bar: { fooobar: { barfoo: true } } }}, { foo: { bar: { fooobar: { barfoo: { _requires: '.val' }}}}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "foo.bar.fooobar.val" does not meet the requirements of "foo.bar.fooobar.barfoo"' ); }

		try
		{
			Normalizer({ foo: { bar: { fooobar: { barfoo: true } } }}, { foo: { bar: { fooobar: { barfoo: { _requires: '..val' }}}}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "foo.bar.val" does not meet the requirements of "foo.bar.fooobar.barfoo"' ); }


		try
		{
			Normalizer({ foo: { bar: { fooobar: { barfoo: true } } }}, { foo: { bar: { fooobar: { barfoo: { _requires: 'bar' }}}}});

			assert.fail();
		}
		catch(e){ assert.equal( e.message, 'Invalid options: "bar" does not meet the requirements of "foo.bar.fooobar.barfoo"' ); }
	});

	it('should pass', function()
	{
		assert.deepStrictEqual
		(
			Normalizer(
			{
				frame:
	   			{
					limit: 104857600,
	     			compression: { _default: false, treshold: 1024 }
				}
			},
			{
				tls 	: { _required: false, _type: 'object' },
				frame	:
				{
					_expand	: true,

					mask	: { _type: 'boolean', _default: true },
					limit	: { _type: 'number', _default: 100 * 1024 * 1024, _convert: $ => Math.min( $, 100 * 1024 * 1024 )},
					compression	:
					{
						_default: false, _expand: true,

						treshold: { _type: 'number', _default: 1024 }
					}
				}
			}),
			{
				frame:
		   		{
					mask: true,
					limit: 104857600,
					compression:
					{
						treshold: 1024
					}
				}
			}
		);
	});
});
/*
_required 	: true,
_type 		: [ 'object', 'string', 'number' ],
_any 		: [ '2', 54 ],
_passes		: $ => 52 < $ && $ < 89,
_convert	: $ => $ + 5,
_default 	:
{
	a: 'b'
},
_requires 	: [ '.asdas', '.dasda' ]
*/

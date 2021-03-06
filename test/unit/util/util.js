const should = require('should');
const util = require('../../../lib/util/util');

describe('util/util', () => {
  describe('isBlank', () => {
    const { isBlank } = util;
    it('should return true for nonexistentish values', () => {
      isBlank(null).should.equal(true);
      isBlank(undefined).should.equal(true);
      isBlank('').should.equal(true);
    });

    it('should return false for existentish values', () => {
      isBlank(' ').should.equal(false);
      isBlank(0).should.equal(false);
      isBlank(false).should.equal(false);
    });
  });

  describe('printPairs', () => {
    // testing here is light as this is only ever used to format debug text.
    const { printPairs } = util;
    it('should print a simple representation of a shallow dictionary', () => {
      printPairs({ a: 1, b: 'test', c: null }).should.equal("a: 1, b: 'test', c: null");
    });
  });

  describe('without', () => {
    const { without } = util;
    it('should remove the specified keys', () => {
      without([ 'b', 'd' ], { a: 1, b: 2, c: 3, d: 4, e: 5 }).should.eql({ a: 1, c: 3, e: 5 });
    });

    it('should actually remove the keys', () => {
      without([ 'b' ], { a: 1, b: 2 }).hasOwnProperty('b').should.equal(false);
    });

    it('should not touch or reify prototype keys', () => {
      const x = { a: 1, b: 2 };
      const y = Object.create(x);
      y.c = 3;

      without([ 'a' ], y).should.eql({ c: 3 });
      y.a.should.equal(1);
    });

    it('should do nothing given no keys or no obj', () => {
      without([], { a: 1 }).should.eql({ a: 1 });
      without([ 'test' ]).should.eql({});
    });
  });

  describe('ensureArray', () => {
    const { ensureArray } = util;
    it('should wrap non-arrays in an array', () => {
      ensureArray(null).should.eql([ null ]);
      ensureArray({ x: 1 }).should.eql([{ x: 1 }]);
    });

    it('should return arrays as-is', () => {
      ensureArray([]).should.eql([]);
      ensureArray([[]]).should.eql([[]]);
      ensureArray([ undefined ]).should.eql([ undefined ]);
    });
  });

  describe('blankStringToNull', () => {
    const { blankStringToNull } = util;
    it('should crush blank strings', () => {
      (blankStringToNull('') === null).should.equal(true);
    });

    it('should leave everything else alone', () => {
      (blankStringToNull(undefined) === undefined).should.equal(true);
      (blankStringToNull(null) === null).should.equal(true);
      (blankStringToNull(' ') === ' ').should.equal(true);
    });
  });

  describe('superproto', () => {
    const { superproto } = util;
    it('should call superclass instance methods', () => {
      class A {
        test() { return 42; }
      }

      class B extends A {
        test() { return superproto(this).test() / 2; }
      }

      (new B()).test().should.equal(21);
    });
  });
});


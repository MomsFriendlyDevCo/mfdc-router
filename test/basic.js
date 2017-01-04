var expect = require('chai').use(require('chai-as-promised')).expect;
var router = require('../src/mfdc-router');

describe('Basic path resolution', function() {
	var r;
	before(function() {
		r = new router();
		r.when('/foo').id('foo').component('fooCtrl');
		r.when('/bar').id('bar').component('barCtrl');
		r.when('/baz/:id').id('baz').component('bazCtrl');
		r.when('/quz/:id?').id('quz').component('quzCtrl');
		r.when().id('fourOhFour').component('fourOhFourCtrl');

		r.routes.forEach(route => route.router = r); // Attach the router to the rule to make querying it a bit easier
	});

	it('should resolve "/foo"', ()=> expect(r.resolve('/foo')).to.eventually.have.property('_id', 'foo'));
	it('should resolve "/bar"', ()=> expect(r.resolve('/foo')).to.eventually.have.property('_id', 'foo'));
	it('should resolve "/baz/123"', ()=> expect(r.resolve('/baz/123')).to.eventually.have.property('_id', 'baz'));
	it('should resolve "/quz"', ()=> expect(r.resolve('/quz')).to.eventually.have.property('_id', 'quz'));
	it('should resolve "/quz/456"', ()=> expect(r.resolve('/quz/456')).to.eventually.have.property('_id', 'quz'));

	it('should extract parameters for "/baz/123"', ()=> expect(r.go('/baz/123')).to.eventually.have.deep.property('router.params.id', '123'));
	it('should extract parameters for "/quz"', ()=> expect(r.go('/quz')).to.eventually.have.deep.property('router.params.id', null));
	it('should extract parameters for "/quz/456"', ()=> expect(r.go('/quz/456')).to.eventually.have.deep.property('router.params.id', '456'));

	it('should extract the query for "/quz/456?k1=v1"', ()=> expect(r.go('/quz/456?k1=v1')).to.eventually.have.deep.property('router.query.k1', 'v1'));
	it('should extract the query for "/quz/456?k1=v1&k2=v2"', ()=> expect(r.go('/quz/456?k1=v1&k2=v2')).to.eventually.have.deep.property('router.query.k2', 'v2'));
});

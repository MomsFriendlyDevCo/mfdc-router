var expect = require('chai').use(require('chai-as-promised')).expect;
var router = require('../dist/mfdc-router');

describe('Basic path resolution', function() {
	var r;
	before(function() {
		r = new router();
		r.when('/foo').id('foo').component('fooCtrl');
		r.when('/bar').id('bar').component('barCtrl');
		r.when('/baz/:id').id('baz').component('bazCtrl');
		r.when('/quz/:id?').id('quz').component('quzCtrl');
		r.when('/:id/flarp').id('flarp').component('flarpCtrl');
		r.when('/:id1/:id2/bonk').id('bonk').component('bonkCtrl');
		r.when().id('fourOhFour').component('fourOhFourCtrl');

		r.routes.forEach(route => route.router = r); // Attach the router to the rule to make querying it a bit easier
	});

	it('should resolve "/foo"', ()=> expect(r.resolve('/foo')).to.eventually.have.property('_id', 'foo'));
	it('should resolve "/bar"', ()=> expect(r.resolve('/foo')).to.eventually.have.property('_id', 'foo'));
	it('should resolve "/baz/123"', ()=> expect(r.resolve('/baz/123')).to.eventually.have.property('_id', 'baz'));
	it('should resolve "/quz"', ()=> expect(r.resolve('/quz')).to.eventually.have.property('_id', 'quz'));
	it('should resolve "/quz/456"', ()=> expect(r.resolve('/quz/456')).to.eventually.have.property('_id', 'quz'));
	it('should resolve "/789/flarp"', ()=> expect(r.resolve('/789/flarp')).to.eventually.have.property('_id', 'flarp'));
	it('should resolve "/012/345/bonk"', ()=> expect(r.resolve('/012/345/bonk')).to.eventually.have.property('_id', 'bonk'));

	it('should extract parameters for "/quz"', ()=> expect(r.go('/quz')).to.eventually.have.deep.property('router.params.id', null));
	it('should extract parameters for "/quz/456"', ()=> expect(r.go('/quz/456')).to.eventually.have.deep.property('router.params.id', '456'));
	it('should extract the query for "/quz/456?k1=v1"', ()=> expect(r.go('/quz/456?k1=v1')).to.eventually.have.deep.property('router.query.k1', 'v1'));
	it('should extract the query for "/quz/456?k1=v1&k2=v2"', ()=> expect(r.go('/quz/456?k1=v1&k2=v2')).to.eventually.have.deep.property('router.query.k2', 'v2'));
	it('should extract the query for "/789/flarp"', ()=> expect(r.go('/789/flarp')).to.eventually.have.deep.property('router.params.id', '789'));

	it('should extract the query for "/012/345/bonk"', function(done) {
		r.go('/012/345/bonk')
			.then(r => {
				expect(r).to.have.deep.property('router.params.id1', '012');
				expect(r).to.have.deep.property('router.params.id2', '345');
				done();
			});
	});
});

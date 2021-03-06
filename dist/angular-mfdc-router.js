

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
* MFDC exceedingly splendid front-end router
* Because there is an upper limit to the insanity we can cope with in angular-ui-router. We crossed that line some time ago.
* @author Matt Carter <m@ttcarter.com>
* @date 2016-11-10
*/

angular.module('angular-mfdc-router', []).service('$router', ['$location', '$q', '$rootScope', function ($location, $q, $rootScope) {
	var router = this;
	router.routes = [];
	router.path = null; // The current path portion of the route
	router.params = {}; // Extracted parameters based on the rule tokens
	router.query = {}; // Query portion of the URI
	router.current = null; // The current matching rule
	router.priorityAliases = { first: 100, highest: 100, normal: 50, default: 50, low: 25, lowest: 0, last: 0 };
	router.nextRuleId = 0;
	router.sort = {
		enabled: true,
		isSorted: false,
		keyOrder: [{ key: '_priority', reverse: true }, { key: '_pathHuman', charOrder: 'abcdefghijklmnopqrstuvwxyz0123456789:/-_', fallback: function fallback() {
				return String.fromCharCode(65000);
			} }, { key: '_path', charOrder: 'abcdefghijklmnopqrstuvwxyz0123456789:/-_', fallback: function fallback() {
				return String.fromCharCode(65000);
			} }],
		// Sorter {{{
		// Code taken in-part from https://github.com/hash-bang/string-sort (author of this module is the author of string-sort)
		// See that module for a test kit and documentation
		// TL;DR - this is a [Schwartzian Transform](https://en.wikipedia.org/wiki/Schwartzian_transform)
		sorter: function sorter() {
			// Cache the lookup table for each key rule
			router.sort.keyOrder.forEach(function (keyRule) {
				if (keyRule.charOrder) {
					keyRule.charOrderTable = {};
					keyRule.charOrder.split('').forEach(function (c, i) {
						return keyRule.charOrderTable[c] = String.fromCharCode(i + 65);
					});
				}
			});

			router.routes = router.routes.map(function (r) {
				return [r].concat(router.sort.keyOrder.map(function (keyRule) {
					// Pack the rules into an array of the form [RouterRule, fields...]
					// Construct each key value
					if (!_.hasIn(r, keyRule.key)) {
						// Lookup key missing
						return undefined;
					} else if (keyRule.charOrderTable) {
						// Translate string into something we can use
						return r[keyRule.key].toString().split('').map(function (c) {
							return keyRule.charOrderTable[c] || keyRule.fallback(c);
						}).join('');
					} else {
						// Just return the value
						return r[keyRule.key];
					}
				}));
			}).sort(function (a, b) {
				// Sort everything...
				for (var k = 0; k < router.sort.keyOrder.length; k++) {
					// Compare each field until we hit something that differs
					if (_.isUndefined(a[k + 1]) || _.isUndefined(b[k + 1])) continue; // Skip non-existant comparitors
					if (a[k + 1] == b[k + 1]) continue; // Fall though as both values are the same
					// If we got here the fields differ
					return a[k + 1] > b[k + 1] ? router.sort.keyOrder[k].reverse ? -1 : 1 : router.sort.keyOrder[k].reverse ? 1 : -1;
				}
			}).map(function (i) {
				return i[0];
			}); // Unpack and return the rule again
		}
		// }}}
	};
	router.warns = {
		requiresChecking: true // Warn when passing an object / promise to rule.requires() rather than a promise factory
	};
	router.tokenRules = {}; // Token validators (see router.tokenRule)

	router.redirect = function (url) {
		$location.path(url);
	};

	router.setHash = function (hash) {
		location.hash = (hash.startsWith('#') ? '' : '#') + hash;
	};

	// Rule instance {{{
	/**
 * A router rule instance
 * @param {string|RegExp} path An initial path value to set (internally calls .path())
 */
	var RouterRule = function RouterRule(path) {
		var _this = this;

		this._id = 'route-' + router.nextRuleId++;
		this._path;
		this._action = 'views'; // Action to take when the rule matches. ENUM: 'views' (let each view handle the action), 'redirect' (router will redirect entire page)
		this._component = { main: null };
		this._redirect;
		this._segments = []; // The extracted capture groups for the rule in order. Each item has 'id', 'required' and an optional 'validator'
		this._priority = 50;
		this._requires = [];
		this._data = {};
		this._params = {};

		/**
  * The current view state
  * Each element key should correspond to a <router-view route-id="ID"></router-view> ID
  * @var {Object}
  */
		this.views = {
			/*
   example: { // ID should the router-view ID to react to
   	method: String, // ENUM: 'component', 'template',
   	content: String, // The component to render if method==component, template if method==template or the templateUrl if method==templateUrl
   },
   */
		};

		/**
  * Set the ID of this rule
  * Normally an ID is automatically generated - this allows an easier method to identify routes
  * @param {string|number} A unique identifier for this rule
  * @return {RouterRule} This chainable object
  */
		this.id = function (newId) {
			this._id = newId;
			return this;
		};

		/**
  * Set the component to use when the rule is satisfied
  * @param {string|Object} [id='main'] The ID of the component to set, if omitted 'main' is assumed
  * @param {string} component The component to use
  * @return {RouterRule} This chainable object
  * @example
  * // Set the main router-view to 'fooCtrl'
  * Rule.component('fooCtrl');
  * // OR
  * Rule.component('main', 'fooCtrl');
  *
  * @example
  * // Set the main router-view to 'fooCtrl' and the 'aside' router-view to 'barCtrl'
  * Rule.component('fooCtrl');
  * Rule.component('aside', 'barCtrl');
  * // OR
  * Rule.component({main: 'fooCtrl', aside: 'barCtrl'});
  */
		this.component = function (id, component) {
			this._action = 'views';

			// Yes I know this string is pretty much unreadbable it translates to the code below
			// Its like this so that this funciton doesn't blow out in size when we copy it three times (template() + templateUrl())
			return this.view(_.isObject(id) ? id : 'main', 'component', _.isString(id) ? id : undefined);

			/*
   // Actual logic is as follows:
   if (_.isObject(id)) { // Form: (object)
   	this.view(id, 'component');
   } else if (!template) { // Form: ([id='main'], template)
   	this.view('main', 'component', id);
   } else if (id && component) { // Form: (id, component)
   	this.view(id, 'component', component);
   }
   */
		};

		/**
  * Set the template to use when the rule is satisfied
  * A template can either be a HTML string or (if it begins with '/' a path)
  * NOTE: This function obeys much the same functionality as RouterRule.component() so see its definition for examples to set single, multiple or all view contents
  * @param {string} [id='main'] The ID of the component to set, if omitted 'main' is assumed
  * @param {string} template The template or absolute template path to use
  * @return {RouterRule} This chainable object
  */
		this.template = function (id, template) {
			this._action = 'views';

			// See component() for why this expression is written like this
			return this.view(_.isObject(id) ? id : 'main', 'template', _.isString(id) ? id : undefined);
		};

		/**
  * Set the templateUrl to use when the rule is satisfied
  * A template can either be a HTML string or (if it begins with '/' a path)
  * NOTE: This function obeys much the same functionality as RouterRule.component() so see its definition for examples to set single, multiple or all view contents
  * @param {string} [id='main'] The ID of the component to set, if omitted 'main' is assumed
  * @param {string} url The template or absolute template path to use
  * @return {RouterRule} This chainable object
  */
		this.templateUrl = function (id, url) {
			this._action = 'views';

			// See component() for why this expression is written like this
			return this.view(_.isObject(id) ? id : 'main', 'templateUrl', _.isString(id) ? id : undefined);
		};

		/**
  * Alias of templateUrl
  * @alias templateUrl
  */
		this.templateURL = this.templateUrl;

		/**
  * Set all or a specific views actions
  * This function can be called in a variety of ways
  * @param {string|Object} id The ID of the view to set OR an object to set all
  * @param {string} [method] Optional method to set if ID is an object, required if all parameters are strings
  * @param {string} [content] Optional content to set if the ID is an object, required if all parameters are strings
  * @return {RouterRule} This chainable object
  * @example
  * // Set all views - same as just setting RouterRule.views manually (Object)
  * RouterRule.view({main: {method: 'component', content: 'fooCtrl'}})
  * // Set all views, and define the method to set (Object, String)
  * RouterRule.view({main: {content: 'fooCtrl'}, aside: {content: 'barCtrl'}}, 'component') // Sets action=component in each case
  * // Set a specific view to a method with content (can be called multiple times; String, String, String)
  * RouterRule.view('main', 'component', 'fooCtrl')
  */
		this.view = function (id, method, content) {
			this._action = 'views';
			if (_.isObject(id)) {
				// Form: (object) - set everything all at once, trust that the user knows what its doing
				this.views = _.mapValues(id, function (v, k) {
					return { content: v };
				});
				if (method) _.forEach(this.views, function (v, k) {
					return v.method = method;
				}); // Method also specified - set this in each object value
			} else if (_.isString(id) && _.isObject(method)) {
				// Form: (string, object) - Set a specific view's object
				this.views[id] = method;
			} else if (_.isString(id) && _.isString(method) && _.isString(content)) {
				// Form: (string, string, string) - Set a specific ID's view, method and contents as strings
				this.views[id] = { method: method, content: content };
			} else {
				throw new Error('Unknown call pattern. See docs for RouterRule.view() for permitted patterns');
			}

			return this;
		};

		/**
  * Set the a path to redirect to if this rule is satisfied
  * @param {string} component The component to use
  * @return {RouterRule} This chainable object
  */
		this.go = function (path) {
			this._action = 'redirect';
			this._redirect = path;
			return this;
		};

		/**
  * Alias of go
  * @see go()
  */
		this.redirect = this.go;

		/**
  * Set the priority of this rule
  * @param {number|string} The priority number or alias (see router.priorityAliases)
  * @return {RouterRule} This chainable object
  */
		this.priority = function (priority) {
			if (isFinite(priority)) {
				this._priority = priority;
			} else if (router.priorityAliases.hasOwnProperty(priority)) {
				this._priority = router.priorityAliases[priority];
			} else {
				throw new Error('Unknown priority number or alias: ' + priority);
			}
			return this;
		};

		/**
  * Set the data element of a rule
  * This is really just a setter for _data
  * @param {*} key The data element to set. If this is a single elemnt the entire data object is overwritten, this can also be a key along with the next value
  * @param {*} value If this is specified this function acts as a setter of the form `data(key, value)`
  * @return {RouterRule} This chainable object
  */
		this.data = function (key, value) {
			if (value === undefined) {
				this._data = data;
			} else {
				this._data[key] = value;
			}
			return this;
		};

		/**
  * Inject additional parameters into the router.params structure if this route matches
  * @param {*} key The data element to set. If this is a single elemnt the entire data object is overwritten, this can also be a key along with the next value
  * @param {*} value If this is specified this function acts as a setter of the form `params(key, value)`
  * @return {RouterRule} This chainable object
  */
		this.params = function (key, value) {
			if (value === undefined) {
				this._params = data;
			} else {
				this._params[key] = value;
			}
			return this;
		};

		/**
  * Shortcut function to call RouterRule.data('title', DATA)
  * @param {string} title A suitable title string to set
  * @see data()
  */
		this.title = function (title) {
			return _this.data('title', title);
		};

		/**
  * Sets a requirement for the rule to be satisfied
  * This is a promise or array of promises which must resolve for the rule to be satisfied
  * NOTE: All regular functions will be transformed into promises (so we can process them faster later)
  * @param {array|Promise} ...test Either a single promise or an array of promises to be satisfied for the rule to match
  * @return {RouterRule} This chainable object
  */
		this.requires = function () {
			if (router.warns.requiresChecking) {
				_.flatten(arguments).forEach(function (p) {
					if (!_.isFunction(p)) {
						console.warn('RouterRule.requires() must be passed a PROMISE FACTORY - ' + (_.hasIn(p, 'then') ? 'promises only ever run once!' : 'was given unexpected type: ' + (typeof p === 'undefined' ? 'undefined' : _typeof(p))) + ' Pass in a factory or disable this message with router.warnings("requiresChecking", false)');
					}
				});
			}

			Array.prototype.push.apply(this._requires, _.flatten(arguments));

			return this;
		};

		/**
  * Alias of requires()
  * @see requires
  */
		this.require = this.requires;

		/**
  * Return if the given path satisfies this rule
  * @param {string} path The path to test against
  * @param {boolean} [requires=true] Obey requires attached to the rule
  * @return {Promise} A promise which will resolve if this rule is satisfied by the given path
  */
		this.matches = function (path, requires) {
			return $q(function (resolve, reject) {
				var segValues;

				if ( // Matches basic pathing rules (if no path pass though)
				!_this._path || // Either this rule doesnt have a path OR
				_this._path.test(path) && ( // The patch matches AND
				segValues = _this.extractParams(path)) && // Parameters can be extracted from the path
				_this._segments.every(function (seg) {
					return _.isFunction(seg.validator) ? seg.validator(segValues[seg.id]) : seg.validator;
				}) // If this segment has a validator use its return
				) {
					if (!_this._requires.length || requires === false) return resolve();

					$q.all(_this._requires.map(function (r) {
						var factoryReturn = r(path, _this);
						if (factoryReturn === true) {
							// Respect true/false returns and map them to promise resolve / rejects
							return $q.resolve();
						} else if (factoryReturn === false) {
							return $q.reject();
						} else {
							// Everything else - throw at $q.all() and let it resolve them
							return factoryReturn;
						}
					})) // Run each factory function to crack open the promise inside then resolve it
					.then(function () {
						return resolve();
					}).catch(function () {
						return reject();
					});
				} else {
					reject();
				}
			});
		};

		/**
  * Set the path matcher in the rule
  * This can be a string in Ruby style e.g. `/foo/bar/:id?` or a RegExp
  * @param {string|regexp} path The path to set
  * @return {RouterRule} This chainable object
  */
		this.path = function (path) {
			if (_.isRegExp(path)) {
				// Is a RegExp
				this._path = path;
				this._segments = [];
			} else if (_.isString(path) && path) {
				// Is a string
				this._pathHuman = path; // Store the human version of the path for sorting later
				this._path = router.pathToRegExp(path);
				this._segments = (path.match(/:[a-z0-9_-]+\??/gi) || []).map(function (seg) {
					var segExamined = /^:(.+?)(\?)?$/.exec(seg);
					return {
						id: segExamined[1],
						required: !segExamined[2],
						validator: router.tokenRules[segExamined[1]] || true
					};
				});
			}
		};

		/**
  * Extract the parameters from a given path
  * This is used to populate router.params when we navigate
  * @param {string} path The path component to match against
  * @return {Object} A populated object with all the tokens extracted
  */
		this.extractParams = function (path) {
			if (!this._path) return {};
			var extracted = this._path.exec(path);
			var params = {};
			this._segments.forEach(function (seg, i) {
				return params[seg.id] = extracted && extracted[i + 1] ? extracted[i + 1].replace(/^\//, '') : null;
			});
			return params;
		};

		/**
  * Turn a raw query string into an object
  * The query string can optionally begin with a '?'
  * @params {string} query The raw query string to process
  * @return {Object} A populated object from the query string
  */
		this.extractQuery = function (query) {
			if (!query) return {};

			return _(_(query).trimStart('?').split('&')).map(function (pair) {
				var keyVal = pair.split('=', 2);
				return keyVal.length < 2 ? [keyVal[0], true] : keyVal;
			}).fromPairs().mapKeys(function (v, k) {
				return decodeURIComponent(k);
			}).mapValues(function (v, k) {
				return decodeURIComponent(v);
			}).value();
		};

		this.path(path); // Set initial path if there is one
		router.routes.push(this);
		router.sort.isSorted = false;
		return this;
	};
	// }}}

	/**
 * Convert a token path into a regular expression
 * @param {string} path The path to convert
 * @return {RegExp} A valid regular expression
 */
	router.pathToRegExp = function (path) {
		var safePath = path.replace(/\/:[a-z0-9_-]+(\?)?/gi, function (all, optional) {
			return '!!!CAPTURE ' + (optional ? 'OPTIONAL' : 'REQUIRED') + '!!!';
		}) // Change all :something? markers into tokens
		.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\' + String.fromCharCode(36) + '&') // Convert all remaining content into a 'safe' string (regexp encoding)
		.replace(/!!!CAPTURE OPTIONAL!!!/g, '(\\/[^\/]+)?') // Drop the capture groups back into the expression
		.replace(/!!!CAPTURE REQUIRED!!!/g, '(\\/[^\/]+)'); // Drop the capture groups back into the expression

		return new RegExp('^' + safePath + String.fromCharCode(36));
	};

	/**
 * Create a new router rule
 * @param {string} [path] Optional path to set
 */
	router.rule = function (path) {
		return new RouterRule(path);
	};

	/**
 * Shortcut to create a new rule
 * @see rule()
 */
	router.when = router.rule; // Shortcut function


	/**
 * Return what rule would match if given a path to examine
 * This function also resorts the router stack if router.sort.isSorted is false
 * @param {string} path The path to examine
 * @return {Promise} A promise with the resolved rule
 */
	router.resolve = function (path) {
		if (router.sort.enabled && !router.sort.isSorted) {
			router.sort.sorter();
			router.sort.isSorted = true;
		}

		return $q(function (mainResolve, mainReject) {
			// Compose a resolver by creating a series chain of rules (each rule is the parent of the previous using .then())
			var resolver = router.routes.reduce(function (chain, rule) {
				return chain.then(function () {
					return $q(function (ruleResolve, ruleReject) {
						// For each rule return a promise that is upside down - if it resolves, the rule matches and it should call the mainResolve, if it DOESN'T it should resolve anyway so the next one can run

						rule.matches(path).then(function () {
							return mainResolve(rule);
						}) // If the rule matches fire the mainResolver which also stops this chain being processed
						.catch(function (err) {
							if (err) {
								mainReject(err);
							} else {
								ruleResolve();
							}
						}); // If it errored see if its a valid complaint (if so reject it via mainReject) else continue on
					});
				});
			}, $q.resolve()).then(function () {
				return mainReject('Nothing matches');
			});
		});
	};

	/**
 * Navigate to the given path if it exists
 * NOTE: This is the internal router command to act 'as if' a route was triggered.
 *       If you want to BOTH trigger a route AND update the URL use $location.path('/somewhere')
 *
 * @param {string} [rawPath] The path to navigate to. If path is falsy, '/' is assumed
 * @param {Object} [params] Optional set of parameters to pass to the route (set into router.params as low priority - i.e. the router rule can overwrite these in its path tokens or via RouterRule._params)
 * @return {Promise} A promise object for the navigation
 */
	router.go = function (rawPath, params) {
		if (!rawPath) rawPath = '/';

		$rootScope.$broadcast('$routerStart', router.current);

		return $q(function (resolve, reject) {
			// Break the path into the path portion + query string
			var urlInfo = /^(.*?)(\?.*)?$/.exec(rawPath);
			var path = urlInfo[1];
			var query = urlInfo[2];

			router.resolve(path).then(function (rule) {
				var previousRule = router.current;
				router.path = path;
				router.current = rule;
				// We cant just set router.params as that would break the references to it - so we have to empty it, then refill
				_.forEach(router.params, function (v, k) {
					return delete router.params[k];
				});
				if (_.isObject(params)) _.assign(router.params, params); // Inject from this function call if passed any
				_.assign(router.params, rule.extractParams(path)); // Inject from the URL tokens
				_.assign(router.params, _.mapValues(rule._params, function (v, k) {
					// Inject from RouterRule._params object (unwrap functions if the parameter value needs evaluating)
					if (_.isFunction(v)) {
						return v();
					} else {
						return v;
					}
				}));

				// Clear out + rebuild router.query also
				_.forEach(function (v, k) {
					return delete router.query[k];
				});
				_.assign(router.query, rule.extractQuery(query));

				resolve(rule);
				// If we're not changing the component but we ARE changing the params we need to fire routerSuccess anyway
				if (previousRule && _.isEqual(previousRule.views, rule.views)) $rootScope.$broadcast('$routerSuccess', router.current);

				$rootScope.$broadcast('$routerStartResolved', rule, previousRule);

				switch (router.current._action) {
					case 'views':
						// Do nothing - router.views[id] should be detected as changed by the downstream router-view components which should then reconfigure themselves
						break;
					case 'redirect':
						router.redirect(router.current._redirect);
						break;
					default:
						throw new Error('Unknown router action: ' + router.current._action);
				}
			}).catch(function (err) {
				$rootScope.$broadcast('$routerError', err);
				reject(err);
			});
		});
	};

	/**
 * Disable a specific warning flag or all flags by just passing `false`
 * @param {string|boolean} key Either the key of the warning to set the value of OR a boolean to set all
 * @param {boolean} [value] The new value of the key if one was specified
 * @return {router} This chainable object
 */
	router.warnings = function (key, val) {
		if (_.isBoolean(key)) {
			_.forEach(router.warns, function (v, k) {
				return router.warns[k] = val;
			});
		} else if (router.warns[key]) {
			router.warns[key] = val;
		} else {
			throw new Error('Unknown warning key to disable: ' + key + '. Valid warning keys are: ' + _.keys(router.warns));
		}

		return router;
	};

	/**
 * Define a rule to be used with a given token.
 * This should be a function that will return whether the given value can be accepted to satisfy that rule segment
 * Token rules are defined centrally in router.tokenRules
 * @param {string} token The token to validate against. Leading ':' will be automatically removed
 * @param {function} function(value) Validation function that is expected to return a truthy value if the segment validates
 * @return {router} This chainable router object
 */
	router.tokenRule = function (token, validator) {
		router.tokenRules[_.trimStart(token, ':')] = validator;
		return router;
	};

	/**
 * Set the query portion of the URL and trigger a renaviate operation
 * @param {string|Object|undefined} key The key portion of the query to set. If this is falsy all query items are removed. If this is an object the entire query is overwritten. If this is undefined the entire query is removed (equivelent to `{}`)
 * @param {mixed} [val] The value of the router query to set, if this is undefined it is removed
 * @return {router} This chainable router object
 *
 * @example
 * // Set the entire query string (i.e. remove ALL queries excpect the ones given in the object)
 * $router.setQuery({foo: 'foo!'})
 * @example
 * // Set just the 'bar' component of the query (i.e. if anything else exists leave it as is)
 * $router.setQuery('bar', 'bar!')
 * @example
 * // Remove the 'baz' component if its is set, leaving everything else in place
 * $router.setQuery('baz', undefined);
 * // OR
 * $router.setQuery('baz');
 */
	router.setQuery = function (key, val) {
		var newQuery;

		if (val === undefined || _.isEmpty(key)) {
			newQuery = key ? _.clone(router.query) : {};
			delete newQuery[key];
		} else if (_.isObject(key)) {
			newQuery = key;
		} else {
			newQuery = key ? _.clone(router.query) : {};
			newQuery[key] = val;
		}

		router.setHash('#' + router.path + (_.isEmpty(newQuery) ? '' : '?' + _.map(newQuery, function (v, k) {
			return k + '=' + v;
		}).join('&')));

		return router;
	};

	// Setup a watcher on the main window location hash
	$rootScope.$watch(function () {
		return location.hash;
	}, function () {
		var newHash = location.hash.replace(/^#!?/, '');
		router.go(newHash);
	});

	return router;
}]).component('routerView', {
	bindings: {
		routeId: '@'
	},
	controller: ['$compile', '$element', '$http', '$q', '$rootScope', '$router', '$scope', '$templateCache', '$timeout', function controller($compile, $element, $http, $q, $rootScope, $router, $scope, $templateCache, $timeout) {
		var $ctrl = this;
		$ctrl.$router = $router;

		$scope.$watch('$ctrl.$router.current._id', function (newVer, oldVer) {
			if (!$router.current) return; // Main route not loaded yet
			var id = $ctrl.routeId || 'main';

			var createView = function createView() {
				if (!$router.current.views[id]) return; // Nothing to do
				switch ($router.current.views[id].method) {
					case 'component':
						var componentName = $router.current.views[id].content.replace(/([A-Z])/g, '_$1').toLowerCase(); // Convert to kebab-case
						$element.html($compile('<' + componentName + '></' + componentName + '>')($rootScope.$new()));
						$timeout(function () {
							return $rootScope.$broadcast('$routerSuccess', $router.current, id);
						});
						break;
					case 'template':
						$element.html($compile($router.current.views[id].content)($rootScope.$new()));
						$timeout(function () {
							return $rootScope.$broadcast('$routerSuccess', $router.current, id);
						});
						break;
					case 'templateUrl':
						// Try to fetch from $templateCache then $http
						$q(function (resolve, reject) {
							var template = $templateCache.get($router.current.views[id].content);
							if (template) return resolve(template);

							// No cache entry - use HTTP
							$http.get($router.current.views[id].content, { cache: true }).then(resolve).catch(reject);
						}).then(function (data) {
							return $element.html($compile(data)($rootScope.$new()));
						}).then(function () {
							return $timeout(function () {
								return $rootScope.$broadcast('$routerSuccess', $router.current, id);
							});
						});
						break;
					default:
						// if ($router.current.views[id].method) { // Throw an error if !undefined (if undefined, just clear up and do nothing)
						throw new Error('View "' + id + '" has unknown router view method: "' + $router.current.views[id].method + '"');
					// }
				}
			};

			// Destroy the previous component (if any) and call createView() when done {{{
			var elementChild = $element.children();
			if (elementChild.length > 0) {
				elementChild = angular.element(elementChild[0]);
				if (elementChild.scope) {
					// Destroy the previous component
					$timeout(function () {
						var scope = elementChild.scope();
						scope.$apply(function () {
							scope.$destroy();
							createView();
						});
					});
				} else {
					createView();
				}
			} else {
				createView();
			}
			// }}}
		});
	}]
});
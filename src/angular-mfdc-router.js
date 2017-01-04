/**
* MFDC exceedingly splendid front-end router
* Because there is an upper limit to the insanity we can cope with in angular-ui-router. We crossed that line some time ago.
* @author Matt Carter <m@ttcarter.com>
* @date 2016-11-10
*/

angular
	.module('app')
	.service('$router', function($location, $q, $rootScope) {
		// INCLUDE src/mfdc-router.js //

		// Setup a watcher on the main window location hash
		$rootScope.$watch(_=> location.hash, function() {
			var newHash = location.hash.replace(/^#!?/, '');
			$router.go(newHash);
		});
	})
	.component('routerView', {
		bindings: {
			routeId: '@',
		},
		controller: function($compile, $element, $http, $q, $rootScope, $router, $scope, $templateCache, $timeout) {
			var $ctrl = this;
			$ctrl.$router = $router;

			$scope.$watch(()=> $router.current._id, function(newVer, oldVer) {
				if (!$router.current) return; // Main route not loaded yet
				var id = $ctrl.routeId || 'main';

				if (!$router.current.views[id])  return;

				var createView = function() {
					switch($router.current.views[id].method) {
						case 'component':
							var componentName = $router.current.views[id].content.replace(/([A-Z])/g, '_$1').toLowerCase(); // Convert to kebab-case
							$element.html($compile('<' + componentName + '></' + componentName + '>')($rootScope.$new()));
							$timeout(()=> $rootScope.$broadcast('$routerSuccess', $router.current));
							break;
						case 'template':
							$element.html($compile($router.current.views[id].content)($rootScope.$new()));
							$timeout(()=> $rootScope.$broadcast('$routerSuccess', $router.current));
							break;
						case 'templateUrl':
							// Try to fetch from $templateCache then $http
							$q((resolve, reject) => {
								var template = $templateCache.get($router.current.views[id].content);
								if (template) return resolve(template);

								// No cache entry - use HTTP
								$http.get($router.current.views[id].content, {cache: true})
									.then(resolve)
									.catch(reject)
							})
								.then(data => $element.html($compile(data)($rootScope.$new())))
								.then(() => $timeout(()=> $rootScope.$broadcast('$routerSuccess', $router.current)))
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
					if (elementChild.scope) { // Destroy the previous component
						$timeout(()=> {
							var scope = elementChild.scope();
							scope.$apply(_=> {
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
		},
	})
	.run(function($rootScope, $router, $location) {
		// Trigger initial routing (use $applyAsync so this gets pushed to the bottom of the run() call stack)
		$rootScope.$applyAsync(_=> $router.go($location.path()));
	})

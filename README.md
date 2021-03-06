@MomsFriendlyDevCo/Router / Angular-MFDC-Router
===============================================
A non-annoying, exceedingly simple but extremely powerful router using a chainable syntax.

This module is primarily designed to work with Angular but it should be modular enough to also work with Node - see [testkit](test/).


```javascript
angular
	.module('app')
	.run($router => $router.when('/widgets/:id?').component('widgetsListCtrl'))
	.component('widgetsListCtrl', {
		templateUrl: '/units/widgets/list.tmpl.html',
		controller: function($scope, $router) {
			var $ctrl = this;

			// Do something with the widget ID specified in $router.params.id
		},
	});
```

Features:

* **Chainable syntax** - Use a simple BDD / chainable layout to define routes e.g. `$router.when('/this/path').requires($session.checkLogin).component('something')`
* **Regular Angular event system** - none of that weird `$transition` system Angular-UI-Router uses. The router fires `$rootScope.$broadcast('$routerSuccess')` events like everything else
* **Sensible route prioritization** - tokens are prioritized _LAST_ so `/foo/:id` gets matched after `/foo/create`. Rather than creating weird hierarchical rules, you can just dump rules into the router and let it figure it out
* **Component support** - Components are the future
* **Routes can be updated in real time** - the router will automatically resort rules as things are added and removed
* **Promise based architecture** - fits in better with the way Angular does things and allows for async handling gracefully
* **Central definition of tokens** - define what commonly used capture tokens should need to validate (e.g. that `:id` should be a 24 bit hex string, globally)
* **"Provide" pattern proof** - Angular is hard enough to understand as it is without having to reference two different classes that do seemingly different things. $router exposes exactly ONE well defined and easy to use service
* **Exceptionally small** - Seriously look at the source - its one file of about 80 lines of actual code
* **Exceptionally fast** - Because there is no weird [cruft](http://catb.org/jargon/html/C/cruft.html) to handle there are no excess parts of the router that slows everything down
* **Undefined queries** - No need to define all acceptable query strings. Anything contained after the `?` character gets decoded and placed in `$router.query` which can be watched for changes


Why?
----
Because [angular-ui-router](https://github.com/angular-ui/ui-router) is too bloody complicated, difficult to grok and the documentation sucks.

This project is an attempt to simplify routing to its absolute bare essentials using a sane syntax with sensible examples.


Installation
------------
The following instructions detail how to get MFDC-Router working for an Angular setup:

1. Grab the NPM

```shell
npm install --save @momsfriendlydevco/router
```


2. Install the required script somewhere in your build chain or include it in a HTML header:

```html
<script src="/libs/@momsfriendlydevco/router/dist/angular-mfdc-router.min.js"/>
```


3. Include the router in your main `angular.module()` call:

```javascript
var app = angular.module('app', ['angular-mfdc-router'])
```


4. Start using the router by defining paths:

```javascript
app
	.run($router => $router.when('/foo').component('fooCtrl'))
	.component('fooCtrl', {
		// ... //
	})
```


Common usage
============

```javascript
// Use a given controller when matching a path (ID will be available in $router.params.id)
$router.when('/widgets/:id').component('widgetsListCtrl');

// Specify that some parameters are optional - just suffix each token with a question mark
$router.when('/foo/:id1?/:id2?/:id3?').component('fooCtrl');

// When visiting one URL redirect to another
$router.when('/foo').go('/bar');
// OR
$router.when('/foo').redirect('/bar');

// Set the priority of a routing rule
$router.when('/foo').priority('low').redirect('/somewhere/else');

// Require that a rule only matches if a promise resolves correctly (we assume $session.isLoggedIn works)
$router.when('/super-secure-area').requires($session.isLoggedIn).component('superSecureCtrl');

// ... or multiple promises
$router.when('/super-secure-area')
	.require(something)
	.require(somethingElse)
	.require([lots, o, promises])
	.component('superSecureCtrl');


// Listen for routing events and perform an action when the page has changed

// Before we navigate...
$rootScope.$on('$routerStart', ()=> /* Do something */)

// After we navigated
$rootScope.$on('$routerSuccess', ()=> /* Do something */)

// After we navigated and something went wrong
$rootScope.$on('$routerError', ()=> /* Do something */)
```


API
===

$router (service)
-----------------
A global Angular service. This can be required anywhere in your project and always exposes the same data.

$router.routes
--------------
An array in priority order of all currently configured rules.

$router.path
------------
The current path portion of the route.

$router.params
--------------
An object containing all parameters extracted from the URL in tokenized form.

For example if the rule has the path `/widgets/:id` and the current URL is `/widgets/123` the parameters object will be `{id: 123}`.

**NOTE**: This object will never break its reference meaning it can be watched and rebound.

$router.query
-------------
An object containing all query parameters extracted from the URL.

For example if the rule has the path `/widgets/:id` and the current URL is `/widgets/123?foo=bar&baz` the parameters object will be `{foo: 'bar', baz: true}`.

**NOTE**: This object will never break its reference meaning it can be watched and rebound.

$router.setQuery(key, [val])
----------------------------
Set the query string and force a re-evaluate operation.

This function can be called in a variety of ways:

* If `key` is empty or equal to `{}` the entire query is removed
* If `key` is an object the new object will completely overwrite any existing query values
* If `key` is a string and `val` is set, just one query portion will be set
* If `key` is a string and `val` is undefined (or omitted) the given query key will be removed.

```javascript
// Set the entire query string (i.e. remove ALL queries excpect the ones given in the object)
$router.setQuery({foo: 'foo!'})

// Set just the 'bar' component of the query (i.e. if anything else exists leave it as is)
$router.setQuery('bar', 'bar!')

// Remove the 'baz' component if its is set, leaving everything else in place
$router.setQuery('baz', undefined);
// OR
$router.setQuery('baz');
```

$router.tokenRule(token, validator)
-----------------------------------
Define a rule to be used with a given token.  This should be a function that will return whether the given value can be accepted to satisfy that rule segment

```javascript
// Any URL containing ':id' will only validate if ID is a number
$router.tokenRule(':id', v => /^0-9+$/.test(v));

// Any URL containing ':id' will only validate if ID is a MongoDB style ObjectID
$router.tokenRule(':id', v => /^[0-9a-f]+$/.test(v));

// Only allow ISO style dates (year-month-day)
$router.tokenRule(':date', v => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v));
```


$router.current.main
--------------------
The currently matched rule.

$router.priorityAliases
-----------------------
A lookup object of different priority aliases - e.g. `lowest`, `normal` etc.

$router.sort
------------
Various configuration options to sort the `$router.routes` collection. This contains `$router.sort.enabled` which toggles whether to sort, `$router.sort.isSorted` which specifies the dirty flag of the routes being sorted, `$router.sort.keyOrder` which is a complex collection of how to sort the array (see the source code). The sorting function can be overridden by subclassing / decorating `$router.sort.sorter`.

$router.warns
-------------
An object containing a list of keys corresponding to various functions the router will check before it runs. These should only ever be enabled at run time as they take extra processing cycles.

Use `$router.warnings(KEY, ENABLED)` to set by key or disable them all with `$router.warnings(false)` to disable all.


$router.pathToRegExp()
----------------------
Utility function to convert a path into a regular expression.

$router.rule(path)
------------------
Create a new router rule and append it onto the `$router.routes` stack.

See [RouterRule](#routerrule).

$router.warnings(key, value) / $router.warnings(false)
------------------------------------------------------
Disable a specific warning / debugging flag within the router or disable all flags with `$router.warnings(false)`.

$router.when(path)
------------------
Alias of `$router.rule(path)`.

$router.resolve(path)
---------------------
Return the first matching router rule that matches the given path.

$router.go(path) / $router.redirect(path)
-----------------------------------------
Navigate to the given path.


RouterRule (Object instance)
----------------------------
An instance of a router rule.
If a path is specified `RouterRule.path()` is automatically called.

RouterRule.data(object | key,value)
-----------------------------------
Store data in the routers rule.
This is a handy area to stash information about a route such as the page title.
If passed a single entity the entire `RouterRule._data` element is overwritten, otherwise this function is treated like a key setter.

RouterRule.component([id='main'], componentName)
------------------------------------------------
Configure the action of the rule to display the named component.

If `id` is omitted `"main"` is assumed (i.e. you only have one `<router-view></router-view>` somewhere in your template.

To use single or multiple views you can use any of the following component setting styles:

```javascript
// Sets only the 'main' router-view
RouterRule.component('fooCtrl')

// Same as above
RouterRule.component('main', 'fooCtrl')

// Set the main router-view to the 'fooCtrl' component and the `<router-view route-id="aside"></router-view>` to the 'barCtrl' component
RouterRule
	.component('main', 'fooCtrl')
	.component('aside', 'barCtrl')

// Same as above but using an object
RouterRule
	.component({main: 'fooCtrl', aside: 'barCtrl')
```


RouterRule.go(path) / RouterRule.redirect(path)
-----------------------------------------------
Configure the action of the rule to redirect to another path

RouterRule.matches(path)
------------------------
Tests a given path against the rule. This will return a boolean if the rule matches.

RouterRule.params(Object|id, [value])
-------------------------------------
Set additional parameters be to populated into `$router.params` if this rule matches.
If `value` is a function it is executed when the rule matches and its return value used to populate the parameter. This can be useful if you need to perform some calculation before passing the parameter downstream.

RouterRule.path(path)
---------------------
Set the path of the rule. This can be a tokenized Ruby style path or a regular expression.

RouterRule.priorty(priority)
----------------------------
Set the priority out of 100 that the rule should install itself at in the router rules stack.
The value can either be a number or a string corresponding to an entry in `$router.priorityAliases`.

RouterRule.requires(...tests) / RouterRule.require(...tests)
------------------------------------------------------------
A function, promise or an array therefof of conditions that must be satisfied for this rule to match.

```javascript
// Only match if `$session.promise()` returns correctly
$router.when('/foo')
	.requires($session.promise)
	.component('fooCtrl');
```

**NOTE**: Promises only ever resolve _once_ so its important to pass in a function which _creates a new promise_ (a Promise Factory pattern). This was the factory is instanciated whenever the rule is checked with a new state each time. The Router will warn if it is passed a Promise directly rather than a function which returns a promise.

If you pass in a non-factory function the return value must be a boolean `true` or `false` to map onto `Promise.resolve()` / `Promise.reject()` respectively. All other return values (strings, objects etc.) will be passed to `Promise.all()` to be resolved which generally doesnt do what you want it to. The function is always called as `(path, rule)`.


RouterRule.title(title)
-----------------------
A shorthand function to set the `title` element of `RouterRule._data`.
In effect this calls `RouterRule.data('title', YOUR VALUE)` for you.


RouterRule.template([id], html)
-------------------------------
Configure the action of the rule to display the given HTML string.


RouterRule.templateUrl([id], url)
---------------------------------
Configure the action of the rule to display the given HTML string fetch from either the `$templateCache` object or via `$http`.

**NOTE:** Can also be called as `templateURL()`


RouterRule.extractParams(path)
------------------------------
Function to extract parameters from the URL into the parameters object.


routerView (directive)
----------------------
Used in the main page template to indicate where to place the page content.

```html
<router-view></router-view>
```

Router view can also take the following options:

| Option     | Type   | Default  | Description                                                                              |
|------------|--------|----------|------------------------------------------------------------------------------------------|
| `route-id` | String | `"main"` | The ID of the route to react to. Use `RouterRule.component()` to define this in the rule |


Events
======
The following events are broadcast globally and can be trapped by hooking into the `$rootScope` listener:

```javascript
$rootScope.$on('$routerStart', ()=> console.log('Routing has started!'));
```

Generally the event progression when moving from rule `Foo` to rule `Bar` is:

* `$routerStart(FooRule)`
* `$routerStartResolved(BarRule, FooRule)`
* `$routerSuccess(FooRule, 'main')`

if any error occurs `$routerError(error)` will be emitted.

if you are using one of the '*-debug' scripts `$routerDebug(message)` will also be emitted.


$routerStart
------------
Called as `(currentRule)` when a routing operation starts. Note that `currentRule` is the rule we are *replacing* and we dont yet know the new rule.


$routerStartResolved
---------------------
Called as `(newRule, oldRule)` when routing after we have resolved which rule we are moving *to*.


$routerSuccess
--------------
Called as `(newRule, [id])` when a routing operation completes. ID is the invididual router component that has changed (i.e. multiple routers on the same page).
This is invoked when controllers, redirects or other actions have completed.


$routerError
------------
Called as `(err)` when an error occurs.

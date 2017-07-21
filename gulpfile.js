var babel = require('gulp-babel');
var gulp = require('gulp');
var fs = require('fs');
var preprocess = require('gulp-preprocess');
var rename = require('gulp-rename');
var replace = require('gulp-replace');
var uglify = require('gulp-uglify');

gulp.task('default', ['build']);
gulp.task('build', ['build:mfdc-router', 'build:angular-mfdc-router']);

gulp.task('build:mfdc-router', function() {
	gulp.src('./src/mfdc-router.js')
		.pipe(rename('mfdc-router.js'))
		.pipe(preprocess({
			includeBase: __dirname,
			context: {},
		}))
		.pipe(babel({
			presets: ['es2015'],
		}))
		.pipe(gulp.dest('./dist'))
		.pipe(rename('mfdc-router.min.js'))
		.pipe(uglify({mangle: false}))
		.pipe(gulp.dest('./dist'));
});

gulp.task('build:angular-mfdc-router', function () {
	gulp.src('./src/angular-mfdc-router.js')
		.pipe(rename('angular-mfdc-router.js'))
		.pipe(preprocess({
			includeBase: __dirname,
			context: {angular: true},
		}))
		.pipe(replace(/^.*require\(.+?\);\s*$/gm, ''))
		.pipe(replace(/^.*module\.exports = .*$/gm, ''))
		.pipe(replace(/\n{3,}/g, '\n'))
		.pipe(replace(/setTimeout\(/, '$timeout('))
		.pipe(replace(/\$q.promise/g, '$q'))
		.pipe(babel({
			presets: ['es2015'],
			plugins: ['angularjs-annotate'],
		}))
		.pipe(replace(/^'use strict';$/gm, ''))
		.pipe(gulp.dest('./dist'))
		.pipe(rename('angular-mfdc-router.min.js'))
		.pipe(uglify({mangle: false}))
		.pipe(gulp.dest('./dist'));
});

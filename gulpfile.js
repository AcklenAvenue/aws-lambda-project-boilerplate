var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var fs = require('fs');
var runSequence = require('run-sequence');
var newer = require('gulp-newer');
var tsc = require('gulp-typescript');
var debug = require('gulp-debug');

var compileTypescript = function(srcPath) {
    return gulp.src([srcPath + '/**/*.ts', '!' + srcPath + '/**/*.d.ts'])
        .pipe(newer({
            dest: './dist',
            ext: '.js'
        }))
        .pipe(tsc())
        .pipe(gulp.dest('./dist'));
};

gulp.task('compile-src', function() {
    return compileTypescript('src');
});

// First we need to clean out the dist folder and remove the compiled zip file.
gulp.task('clean', function(cb) {
    return del('./dist',
        del('./archive.zip', cb)
    );
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
    return gulp.src('./package.json')
        .pipe(gulp.dest('./dist/greeter/'))
        .pipe(install({
            production: true
        }));
});

// Now the dist directory is ready to go. Zip it.
gulp.task('zip', function() {
    return gulp.src(['dist/greeter/**/*', '!dist/package.json'])
        .pipe(zip('dist.zip'))
        .pipe(gulp.dest('./'));
});

gulp.task('upload', function(done) {
    AWS.config.region = 'us-east-1';
    var lambda = new AWS.Lambda();
    var functionName = 'hello-world';

    var params = {
        FunctionName: functionName,
        Handler: 'handler.handler',
        Role: 'arn:aws:iam::487799950875:role/lambda_basic_execution',
        Runtime: 'nodejs4.3',
        Code: {}
    };

    fs.readFile('./dist.zip', function(err, data) {
        params.Code['ZipFile'] = data;
        lambda.createFunction(params, function(err, data) {
            if (err) {
                console.log(err);
            }
            done();
        });
    });
});

gulp.task('default', function(callback) {
    return runSequence(
        ['clean'], ['compile-src'], ['npm'], ['zip'], ['upload'],
        callback
    );
});

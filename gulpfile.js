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
var merge = require('merge-stream');
var path = require('path');
const functionsPath = './src';

const listChildDirectoryPaths = function(directoryPath) {
    return fs.readdirSync(directoryPath).filter(function(pathPart) {
        return fs.statSync(path.join(directoryPath, pathPart)).isDirectory();
    });
}

const compileTypescript = function() {
    const lambdas = listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        return gulp.src([functionsPath + '/' + directoryPath + '/**/*.ts', '!' + directoryPath + '/**/*.d.ts'])
            .pipe(newer({
                dest: 'dist/' + directoryPath,
                ext: '.js'
            }))
            .pipe(tsc())
            .pipe(gulp.dest('dist/' + directoryPath));
    });
    return merge(lambdas);
};

gulp.task('compile-src', function() {
    return compileTypescript();
});

// First we need to clean out the dist folder and remove the compiled zip file.
gulp.task('clean', function(cb) {
    return del('./dist',
        del('./archive.zip', cb)
    );
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
    var tasks = listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        return gulp.src('./package.json')
            .pipe(gulp.dest('dist/' + directoryPath))
            .pipe(install({
                production: true
            }));
    });
    return merge(tasks);
});

// Now the dist directory is ready to go. Zip it.
gulp.task('zip', function() {
    const lambdas = listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        return gulp.src(['dist/' + directoryPath+ '/**/*', '!dist/' + directoryPath + 'package.json'])
            .pipe(zip('dist.zip'))
            .pipe(gulp.dest('dist/' + directoryPath));
    });
    return merge(lambdas);
});

gulp.task('upload', function(done) {
    AWS.config.region = 'us-east-1';
    const lambda = new AWS.Lambda();
    const functionName = 'hello-world';
    const api = new AWS.APIGateway();
    listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        fs.readFile('dist/' + directoryPath + '/dist.zip', function(err, data) {
            var params = {
                FunctionName: directoryPath,
                Handler: 'handler.handler',
                Role: 'arn:aws:iam::487799950875:role/lambda-gateway-execution-role',
                Runtime: 'nodejs4.3',
                Code: {}
            };
            params.Code['ZipFile'] = data;
            lambda.createFunction(params, function(err, dataCreateFunction) {
                if (err) {
                    console.log(err);
                }
                var params = {
                    name: 'testapi'
                };
            });
        });
    });
});

gulp.task('default', function(callback) {
    return runSequence(
        ['clean'], ['compile-src'], ['npm'], ['zip'], ['upload'],
        callback
    );
});

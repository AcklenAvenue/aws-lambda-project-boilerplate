var gulp = require('gulp');
var vinylfs = require('vinyl-fs');

gulp.src = vinylfs.src;
gulp.dest = vinylfs.dest;

var config = require('./gulp.config');

var spawn = require('gulp-spawn');
var tsc = require('gulp-typescript');
var clean = require('gulp-clean');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var newer = require('gulp-newer');

var os = require('os');
var path = require('path');

var AWS = require('aws-sdk');
var fs = require('fs');

gulp.task('build', ['compile-src']);

gulp.task('install-typings', function(done) {
    spawn.simple({
        cmd: 'npm' + (os.platform().match(/^win/) ? '.cmd' : ''),
        args: [
            'run',
            'typings'
        ]
    }, done);
});

gulp.task('compile-src', function() {
    return compileTypescript('src');
});

gulp.task('istanbul-setup', ['compile-src'], function () {
  return gulp.src(['src/**/*.js'])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
});

gulp.task('test', ['compile-tests', 'istanbul-setup'], function() {
    return gulp.src(['tests/**/*.js'], {
            read: false
        })
        .pipe(mocha())
        .pipe(istanbul.writeReports());
});

gulp.task('compile-tests', function() {
    return compileTypescript('tests');
});

gulp.task('clean-src', function() {
    return gulp.src(['src/**/*.js', 'src/**/*.d.ts'])
        .pipe(clean());
});

gulp.task('clean-tests', function() {
    return gulp.src(['tests/**/*.js', 'tests/**/*.d.ts'])
        .pipe(clean());
});

gulp.task('clean', ['clean-src', 'clean-tests']);

var compileTypescript = function(srcPath) {
    return gulp.src([srcPath + '/**/*.ts', '!' + srcPath + '/**/*.d.ts'])
        .pipe(newer({
            dest: srcPath,
            ext: '.js'
        }))
        .pipe(tsc())
        .pipe(gulp.dest(srcPath));
};

gulp.task('upload', function() {

  // TODO: This should probably pull from package.json
  AWS.config.region = 'us-east-1';
  var lambda = new AWS.Lambda();
  var functionName = 'hello-world';

  lambda.getFunction({FunctionName: functionName}, function(err, data) {
    if (err) {
      if (err.statusCode === 404) {
        var warning = 'Unable to find lambda function ' + functionName + '. '
        warning += 'Verify the lambda function name and AWS region are correct.'
      } else {
        var warning = 'AWS API request failed. '
        warning += 'Check your AWS credentials and permissions.'
      }
    }

    // This is a bit silly, simply because these five parameters are required.
    var current = data.Configuration;
    var params = {
      FunctionName: functionName,
      Handler: current.Handler,
      Mode: current.Mode,
      Role: current.Role,
      Runtime: current.Runtime
    };

    fs.readFile('./dist.zip', function(err, data) {
      params['FunctionZip'] = data;
      lambda.uploadFunction(params, function(err, data) {
        if (err) {
          var warning = 'Package upload failed. '
          warning += 'Check your iam:PassRole permissions.'
          gutil.log(warning);
        }
      });
    });
  });
});

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
    compileTypescript('src');
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
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
var BlueBird = require('bluebird');
const functionsPath = './src';
const apiName = 'aws-lambda-project-boilerplate';

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
    return del('./dist', cb);
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
        return gulp.src(['dist/' + directoryPath + '/**/*', '!dist/' + directoryPath + 'package.json'])
            .pipe(zip('dist.zip'))
            .pipe(gulp.dest('dist/' + directoryPath));
    });
    return merge(lambdas);
});

gulp.task('upload', function(done) {
    AWS.config.region = 'us-east-1';
    const lambda = new AWS.Lambda();
    const api = new AWS.APIGateway();
    const promises = [];

    listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        promises.push(new BlueBird(function(resolve, reject) {
            fs.readFile('dist/' + directoryPath + '/dist.zip', function(err, data) {
                const lambdaFunction = {
                    FunctionName: directoryPath,
                    Handler: 'handler.handler',
                    Role: 'arn:aws:iam::487799950875:role/lambda-gateway-execution-role',
                    Runtime: 'nodejs4.3',
                    Code: {
                        ZipFile: data
                    }
                };
                lambda.createFunction(lambdaFunction, function(err, dataCreateFunction) {
                    if (err) {
                        return reject(err);
                    }
                    api.getRestApis({}, function(err, data) {
                        if (err) {
                            return reject(err);
                        }
                        const api = data.items.filter(function(api) {
                            return api.name === apiName;
                        })[0];

                        if (api) {
                            const lambdaPermissions = {
                                Action: 'lambda:*',
                                FunctionName: lambdaFunction.FunctionName,
                                Principal: 'apigateway.amazonaws.com',
                                StatementId: 'apigateway-prod-2',
                                SourceArn: `arn:aws:execute-api:us-east-1:487799950875:${api.id}/*/GET/test`
                            };
                            lambda.addPermission(lambdaPermissions, function(err, data) {
                                if (err) {
                                    return reject(err);
                                }
                                resolve(`added permissions to lambda: ${lambdaFunction.FunctionName}`);
                            });
                        }
                    });
                });
            });
        }));
    });
    BlueBird.all(promises).then(function(success) {
        gutil.log(gutil.colors.green(success));
        done();
    }, function(err) {
        gutil.log(gutil.colors.red(err));
        done();
    });
});

gulp.task('deployApi', function(done) {
    AWS.config.region = 'us-east-1';
    const api = new AWS.APIGateway();

    const promise = new BlueBird(function(resolve, reject) {
        fs.readFile('swagger.yml', function(err, data) {
            if (err) {
                return reject(err);
            }
            const params = {
                body: data,
                failOnWarnings: true
            };
            api.getRestApis({}, function(err, data) {
                if (err) {
                    return reject(err);
                }
                const filterApi = data.items.filter(function(api) {
                    return api.name === apiName;
                })[0];

                if (filterApi) {
                    const deleteParams = {
                        restApiId: filterApi.id
                    };
                    api.deleteRestApi(deleteParams, function(err, data) {
                        if (err) {
                            return reject(err);
                        }
                        api.importRestApi(params, function(err, data) {
                            if (err) {
                                return reject(err);
                            }
                            return resolve('Updated API Successfully');
                        });
                    });
                } else {
                    api.importRestApi(params, function(err, data) {
                        if (err) {
                            return reject(err);
                        }
                        return resolve('Imported API Successfully');
                    });
                }

            });

        });
    });

    promise.then(function(success) {
        gutil.log(gutil.colors.green(success));
        done();
    }, function(err) {
        gutil.log(gutil.colors.red(err));
        done();
    });
});

gulp.task('default', function(callback) {
    return runSequence(
        ['clean'], ['compile-src'], ['npm'], ['zip'], ['upload'],
        callback
    );
});

gulp.task('deploy', function(callback) {
    return runSequence(
        ['deployApi'],
        callback
    );
})

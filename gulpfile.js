var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var runSequence = require('run-sequence');
var newer = require('gulp-newer');
var tsc = require('gulp-typescript');
var debug = require('gulp-debug');
var merge = require('merge-stream');
var path = require('path');
var BlueBird = require('bluebird');
const functionsPath = './src';
const apiName = 'aws-lambda-project-boilerplate';
var fs = BlueBird.promisifyAll(require('fs'));

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
    const lambda = BlueBird.promisifyAll(new AWS.Lambda(), {
        suffix: 'Promise'
    });
    const api = BlueBird.promisifyAll(new AWS.APIGateway());

    BlueBird.map(listChildDirectoryPaths(functionsPath), function(directoryPath) {
        return fs.readFileAsync('dist/' + directoryPath + '/dist.zip').then(function(lambdaCode) {
            const lambdaFunctionParams = {
                FunctionName: directoryPath,
                Handler: 'handler.handler',
                Role: 'arn:aws:iam::487799950875:role/lambda-gateway-execution-role',
                Runtime: 'nodejs4.3',
                Code: {
                    ZipFile: lambdaCode
                }
            };
            return lambda.getFunctionPromise({
                FunctionName: lambdaFunctionParams.FunctionName
            }).then(function(lambdaFunction) {
                return lambda.updateFunctionCodePromise({
                    FunctionName: lambdaFunctionParams.FunctionName,
                    ZipFile: lambdaCode
                });
            }, function(err) {
                if (err.cause.code === 'ResourceNotFoundException') {
                    return BlueBird.all([lambda.createFunctionPromise(lambdaFunctionParams), api.getRestApisAsync({})]).spread(function(lambdaFunc, apiFunc) {
                        const apiFilter = apiFunc.items.filter(function(api) {
                            return api.name === apiName;
                        })[0];
                        if (apiFilter) {
                            const lambdaPermissions = {
                                Action: 'lambda:*',
                                FunctionName: lambdaFunctionParams.FunctionName,
                                Principal: 'apigateway.amazonaws.com',
                                StatementId: 'apigateway-prod-2',
                                SourceArn: `arn:aws:execute-api:us-east-1:487799950875:${apiFilter.id}/*/GET/test`
                            };
                            return lambda.addPermissionPromise(lambdaPermissions);
                        }
                    });
                } else {
                    return BlueBird.reject(err);
                }
            });
        });
    }).then(function(success) {
        gutil.log(gutil.colors.green('Lambda functions uploaded correctly'));
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
        fs.readFile('swagger.yml', function(err, swaggerFile) {
            if (err) {
                return reject(err);
            }
            api.getRestApis({}, function(err, apis) {
                if (err) {
                    return reject(err);
                }
                const filterApi = apis.items.filter(function(api) {
                    return api.name === apiName;
                })[0];

                if (filterApi) {
                    const putApiParams = {
                        body: swaggerFile,
                        restApiId: filterApi.id,
                        failOnWarnings: true,
                        mode: 'overwrite'
                    };
                    api.putRestApi(putApiParams, function(err, updatedApi) {
                        if (err) {
                            return reject(err);
                        }
                        const deploymentParams = {
                            restApiId: updatedApi.id,
                            stageName: 'beta'
                        };
                        api.createDeployment(deploymentParams, function(err, deploymentData) {
                            if (err) {
                                return reject(err);
                            }
                            return resolve('Deployed Updated API Successfully');
                        });
                    })
                } else {
                    const importRestApiParams = {
                        body: swaggerFile,
                        failOnWarnings: true
                    };
                    api.importRestApi(importRestApiParams, function(err, apiData) {
                        if (err) {
                            return reject(err);
                        }
                        const deploymentParams = {
                            restApiId: apiData.id,
                            stageName: 'beta'
                        };
                        api.createDeployment(deploymentParams, function(err, deploymentData) {
                            if (err) {
                                return reject(err);
                            }
                            return resolve('Deployed API Successfully');
                        });
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
        ['clean'], ['compile-src'], ['npm'], ['zip'],
        callback
    );
});

gulp.task('deploy', function(callback) {
    return runSequence(
        ['deployApi'], ['upload'],
        callback
    );
})

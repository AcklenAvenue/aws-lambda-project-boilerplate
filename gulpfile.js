var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var spawn = require('gulp-spawn');
var runSequence = require('run-sequence');
var newer = require('gulp-newer');
var tsc = require('gulp-typescript');
var debug = require('gulp-debug');
var clean = require('gulp-clean');
var merge = require('merge-stream');
var path = require('path');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var BlueBird = require('bluebird');
var config = require('./gulp.config');
var swagger = require('./swagger.json');
var fs = BlueBird.promisifyAll(require('fs'));
var os = require('os');

const functionsPath = './src';
const testsPath = './tests';
const accountIDPattern = /<<ACCT_ID>>/g;
const apiName = path.basename(__dirname);
swagger.info.title = apiName;

AWS.config.update({
  accessKeyId: config.awsAccessKeyId,
  secretAccessKey: config.awsSecretAccessKey,
  region: config.awsRegion
});

const listChildDirectoryPaths = function(directoryPath) {
    return fs.readdirSync(directoryPath).filter(function(pathPart) {
        return fs.statSync(path.join(directoryPath, pathPart)).isDirectory();
    });
}

const compileTypescript = function(srcPath) {
    const lambdas = listChildDirectoryPaths(srcPath).map(function(directoryPath) {
        return gulp.src([srcPath + '/' + directoryPath + '/**/*.ts', '!' + directoryPath + '/**/*.d.ts'])
            .pipe(newer({
                dest: 'dist/' + directoryPath,
                ext: '.js'
            }))
            .pipe(tsc())
            .pipe(gulp.dest('dist/' + directoryPath))
            .pipe(gulp.dest('src/' + directoryPath));
    });
    return merge(lambdas);
};

const compileTestsTypescript = function(srcPath) {
    return gulp.src([srcPath + '/**/*.ts', '!' + srcPath + '/**/*.d.ts'])
        .pipe(newer({
            dest: srcPath,
            ext: '.js'
        }))
        .pipe(tsc())
        .pipe(gulp.dest(srcPath));
};

gulp.task('install-typings', function(done) {
    spawn.simple({
        cmd: 'npm' + (os.platform().match(/^win/) ? '.cmd' : ''),
        args: [
            'run',
            'typings'
        ]
    }, done);
});

gulp.task('istanbul-setup', ['compile-src'], function () {
  return gulp.src([`dist/${functionsPath}/**/*.js`])
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
    return compileTestsTypescript(testsPath);
});

gulp.task('compile-src', function() {
    return compileTypescript(functionsPath);
});

gulp.task('clean-tests', function() {
    return gulp.src(['tests/**/*.js', 'tests/**/*.d.ts'])
        .pipe(clean());
});

gulp.task('clean-src', function() {
    return gulp.src(['src/**/*.js', 'src/**/*.d.ts'])
        .pipe(clean());
});

gulp.task('delete-dist', function(cb) {
    return del('./dist', cb);
});

gulp.task('clean', ['delete-dist', 'clean-src', 'clean-tests']);

gulp.task('npm', function() {
    var tasks = listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        return gulp.src(`${functionsPath}/${directoryPath}/package.json`)
            .pipe(gulp.dest('dist/' + directoryPath))
            .pipe(install({
                production: true
            }));
    });
    return merge(tasks);
});

gulp.task('zip', function() {
    const lambdas = listChildDirectoryPaths(functionsPath).map(function(directoryPath) {
        return gulp.src(['dist/' + directoryPath + '/**/*', '!dist/' + directoryPath + 'package.json'])
            .pipe(zip('dist.zip'))
            .pipe(gulp.dest('dist/' + directoryPath));
    });
    return merge(lambdas);
});

gulp.task('upload', function(done) {
    const lambda = BlueBird.promisifyAll(new AWS.Lambda(), {
        suffix: 'Promise'
    });
    const api = BlueBird.promisifyAll(new AWS.APIGateway());

    BlueBird.map(listChildDirectoryPaths(functionsPath), function(directoryPath) {
        return fs.readFileAsync('dist/' + directoryPath + '/dist.zip').then(function(lambdaCode) {
            const lambdaFunctionParams = {
                FunctionName: directoryPath,
                Handler: 'handler.handler',
                Role: `arn:aws:iam::${config.awsAccountNumber}:role/${config.lambdaRole}`,
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
                                StatementId: 'apigateway-prod-2'
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
        throw new gutil.PluginError('AWS Lambda', err);
    });
});

gulp.task('deployApi', function(done) {
    const api = new AWS.APIGateway();

    const promise = new BlueBird(function(resolve, reject) {
        var swaggerBody = JSON.stringify(swagger)
                              .replace(accountIDPattern,
                                       config.awsAccountNumber);
        api.getRestApis({}, function(err, apis) {
            if (err) {
                return reject(err);
            }
            const filterApi = apis.items.filter(function(api) {
                return api.name === apiName;
            })[0];

            if (filterApi) {
                const putApiParams = {
                    body: new Buffer(swaggerBody),
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
                    body: new Buffer(swaggerBody),
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

    promise.then(function(success) {
        gutil.log(gutil.colors.green(success));
        done();
    }, function(err) {
        gutil.log(gutil.colors.red(err));
        throw new gutil.PluginError('AWS Gateway Api', err);
    });
});

gulp.task('default', function(callback) {
    return runSequence(
        ['clean'], ['compile-src'], ['test'], ['npm'], ['zip'],
        callback
    );
});

gulp.task('deploy', function(callback) {
    return runSequence(
        ['deployApi'], ['upload'],
        callback
    );
})

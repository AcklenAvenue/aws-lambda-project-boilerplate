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
        Role: 'arn:aws:iam::487799950875:role/lambda-gateway-execution-role',
        Runtime: 'nodejs4.3',
        Code: {}
    };

    fs.readFile('./dist.zip', function(err, data) {
        params.Code['ZipFile'] = data;
        lambda.createFunction(params, function(err, dataCreateFunction) {
            if (err) {
                console.log(err);
            }
            var api = new AWS.APIGateway();
            var params = {
                name: 'testapi'
            };
            var pathPart = 'test';
            var httpMethod = 'POST';
            api.createRestApi(params, function(err, dataCreateRestAPI) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    console.log(dataCreateRestAPI);
                    var params = {
                        restApiId: dataCreateRestAPI.id
                    };
                    api.getResources(params, function(err, dataGetResources) {
                        if (err) {
                            console.log(err, err.stack);
                        } else {
                            console.log('GET RESOURCES', dataGetResources);

                            var params = {
                                parentId: dataGetResources.items[0].id,
                                pathPart: pathPart,
                                restApiId: dataCreateRestAPI.id
                            };
                            api.createResource(params, function(err, dataCreateResource) {
                                if (err) {
                                    console.log(err, err.stack);
                                } else {
                                    console.log('CREATE RESOURCE', dataCreateResource);

                                    var params = {
                                        authorizationType: 'NONE',
                                        httpMethod: httpMethod,
                                        resourceId: dataCreateResource.id,
                                        restApiId: dataCreateRestAPI.id,
                                        apiKeyRequired: false,
                                    };
                                    api.putMethod(params, function(err, dataPutMethod) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            var params = {
                                                httpMethod: httpMethod,
                                                resourceId: dataCreateResource.id,
                                                restApiId: dataCreateRestAPI.id,
                                                type: 'AWS',
                                                uri: 'arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:487799950875:function:' + functionName + '/invocations',
                                                integrationHttpMethod: httpMethod
                                            };
                                            api.putIntegration(params, function(err, data) {
                                                if (err) {
                                                    console.log('AWS Error', err);
                                                } else {
                                                    console.log('Put Integration Method Created', data);

                                                    var params = {
                                                        Action: 'lambda:*',
                                                        FunctionName: functionName,
                                                        Principal: 'apigateway.amazonaws.com',
                                                        StatementId: 'apigateway-prod-2',
                                                        SourceArn: 'arn:aws:execute-api:us-east-1:487799950875:' + dataCreateRestAPI.id + '/*/POST/test'
                                                    };
                                                    console.log('PARAMS ADD PERMISSION', params);
                                                    lambda.addPermission(params, function(err, data) {
                                                        if (err) {
                                                            console.log(err, err.stack);
                                                        } else {
                                                            console.log(data);
                                                            var params = {
                                                                httpMethod: 'POST',
                                                                resourceId: dataCreateResource.id,
                                                                restApiId: dataCreateRestAPI.id,
                                                                statusCode: '200',
                                                                responseModels: {
                                                                    'application/json': 'Empty',
                                                                },
                                                            };
                                                            api.putMethodResponse(params, function(err, data) {
                                                                if (err) {
                                                                    console.log(err, err.stack);
                                                                } else {
                                                                    console.log('yay', data);
                                                                    var params = {
                                                                        httpMethod: 'POST',
                                                                        resourceId: dataCreateResource.id,
                                                                        restApiId: dataCreateRestAPI.id,
                                                                        statusCode: '200',
                                                                        responseTemplates: {
                                                                            'application/json': '',
                                                                        }
                                                                    };
                                                                    api.putIntegrationResponse(params, function(err, data) {                                                                        if (err) {
                                                                            console.log(err, err.stack);
                                                                        } else {
                                                                            console.log(data);
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
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

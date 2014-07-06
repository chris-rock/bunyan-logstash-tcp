'use strict';

module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            allFiles: ['Gruntfile.js', 'lib/**/*.js', 'examples/**/*.js'],
            options: {
                jshintrc: '.jshintrc',
            }
        },
        mochacli: {
            all: ['test/*.js'],
            options: {
                reporter: 'spec',
                ui: 'tdd'
            }
        }
    });

    // Load the plugins
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');

    // Configure tasks
    grunt.registerTask('default', ['test']);
    grunt.registerTask('test', ['jshint']);
};
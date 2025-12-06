'use strict';

module.exports = function ( grunt ) {
	grunt.loadNpmTasks( 'grunt-eslint' );
	grunt.loadNpmTasks( 'grunt-stylelint' );

	grunt.initConfig( {
		eslint: {
			options: {
				cache: true,
				fix: grunt.option( 'fix' ),
			},
			target: ['gadgets/**/*.{js,ts}']
		},
		stylelint: {
			options: {
				cache: true
			},
			all: [
				'**/*.{css,less}',
				'!node_modules/**',
				'!vendor/**',
				'!dist/**',
			]
		}
	} );

	grunt.registerTask( 'test', [ 'eslint', 'stylelint' ] );
	grunt.registerTask( 'default', 'test' );
};

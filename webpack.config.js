'use strict';

const path = require('path');

const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.json' } }]
            }
        ]
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: { level: 'log' }
};

const dialogWebviewConfig = {
    target: 'web',
    mode: 'none',
    entry: './webview-src/dialog/dialog.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'webview-dialog.js'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.webview.json' } }]
            }
        ]
    },
    devtool: 'nosources-source-map'
};

const resultsWebviewConfig = {
    target: 'web',
    mode: 'none',
    entry: './webview-src/results/results.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'webview-results.js'
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.webview.json' } }]
            }
        ]
    },
    devtool: 'nosources-source-map'
};

module.exports = [extensionConfig, dialogWebviewConfig, resultsWebviewConfig];

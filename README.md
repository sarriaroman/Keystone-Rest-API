# Keystone Rest API

This extension for Keystone is intended to create a REST API very easy. Also is prepared to output the Documentation for the created API. The Documentation is based on API Blueprint ( Format 1A8 ).

## Features
- Automatic REST API
- API Documentataion

## Documentation

[http://sarriaroman.github.io/Keystone-Rest-API](http://sarriaroman.github.io/Keystone-Rest-API)

## Options

 - Model  
 	+ rest {Boolean}  
	
	+ restOptions {String} 'list show create update delete'  
	
	+ restDescription {String}
  
 - List Object    
  	+ restHooks {Object}  

```
{
    list: [listMiddleware],
    show: [showMiddleware],
    create: [createMiddleware],
    update: [updateMiddleware],
	delete: [deleteMiddleware]
}
```
   
 - Fields  
  	+ restSelected {Boolean}  
	
   	+ restEditable {Boolean}  

## Usage

```
    var keystone = require('keystone'),
		fs = require('fs'),
      	Types = keystone.Field.Types,
      	keystoneRestApi = require('keystone-rest-api');

    var User = new keystone.List('User', {
		rest: true,
		restOptions: 'list show create update delete'
	});

    User.add({
      	name: { type: Types.Name, required: true, index: true },
      	password: { type: Types.Password, initial: true, required: false, restSelected: false },
      	token: { type: String, restEditable: false }
    });
	
	User.restHooks = {
      	list: [listMiddleware],
      	show: [showMiddleware],
		create: [createMiddleware],
      	update: [updateMiddleware],
      	delete: [deleteMiddleware]
    };

    User.register();

    // Make sure keystone is initialized and started before
    // calling createRest

    keystone.init(config);

    // Add routes with Keystone
    keystoneRestApi.createRest(keystone, {
		apiRoot: '/api/'
	});

    keystone.start();
	
	// Create Documentation and write it to a file
	fs.writeFileSync('api.md', keystoneRestApi.apiDocs(), 'UTF-8');
```

### Changelog  

___0.9.7.1___  
- Added ignoreNoEdit to Create to avoid awful errors for now  

___0.9.7___  
- restDescription field to specify the Description of the REST Endpoint  
- Use of keystone Name to create the Header of the Blueprint API Document

___0.9.6___  
- Added attributes to Model Definition in the Documentation
- Added Support for Select Field on API Generation
- Added support for Required in Documentation

___0.9.5___  
- Added support for UpdateHandler

### TODO
- The "update" and "create" method must use the Keystone UpdateHandler (Done)  
- Implement a way to set Options for UpdateHandler  

```javascript
restOptions: {
	ignoreNoedit: true
}
```
				
- New Tests based on the changes.  

## Authors

* Román A. Sarria  

* Based on Keystone Rest from Dan Quinn [https://github.com/danielpquinn/keystone-rest](Original Repository)  


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
    keystone.start();

    // Add routes with Keystone
    keystoneRestApi.createRest(keystone, {
		apiRoot: '/api/v1/'
	});
	
	// Create Documentation and write it to a file
	fs.writeFileSync('api.md', keystoneRestApi.apiDocs(), 'UTF-8');
```

### Changelog  

___0.9.6___  
- Added attributes to Model Definition in the Documentation
- Added Support for Select Field on API Generation
- Added support for Required in Documentation

___0.9.5___  
- Added support for UpdateHandler

### TODO
- The "update" and "create" method must use the Keystone UpdateHandler (Done)  
- New Tests based on the changes.  

## Authors

* Román A. Sarria  

* Based on Keystone Rest from Dan Quinn [https://github.com/danielpquinn/keystone-rest](Original Repository)  


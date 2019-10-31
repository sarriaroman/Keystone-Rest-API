'use strict';

var _ = require('lodash');

/**
 * Options
 * 
 * 	- Model
 * 		+ rest {Boolean}
 *  	+ restOptions {String} 'list show create update delete'
 *  
 *  - Methods
 *  	+ restHooks {Object}
 *   
 *   		{
    			list: [listMiddleware],
    			show: [showMiddleware],
    			create: [createMiddleware],
    			update: [updateMiddleware],
    			delete: [deleteMiddleware]
  			}
 *   
 *  - Fields
 *  	+ restSelected {Boolean}
 *   	+ restEditable {Boolean}
 */

/**
 * API Blueprint Documentation templates
 * Variables
 * - name
 * - root
 * - endpoint
 * - attributes
 *
 * + Ignored
 * - id
 */


var api_blueprint = {
	new_line: '\n',
	tab: '    ',

	api_doc_templates: {
		model: '# Endpoint for {name} [{root}{endpoint}]\nThis endpoint will provide all the required methods available for {name}\n\n+ Attributes\n{attributes}\n\n',
		list: '## List all {name} [GET {root}{endpoint}]\nRetrieves the list of {name}\n\n+ Response 200 (application/json)',
		show: '## Retrieve {name} [GET {root}{endpoint}/{id}]\nRetrieves item with the id\n\n+ Response 200 (application/json)',
		create: '## Create a {name} [POST {root}{endpoint}]\n\n+ Attributes\n{attributes}\n\n+ Response 200 (application/json)',
		update: '## Updates a {name} [PUT {root}{endpoint}]\n\n+ Attributes\n{attributes}\n\n+ Response 200 (application/json)',
		delete: '## Deletes an item from {name} [DELETE {root}{endpoint}/{id}]\nDelete a {name}. **Warning:** This action **permanently** removes the {name} from the database.\n\n+ Response 200 (application/json)',
	},

	/**
	 * Gets a method type and the vars and created the documentation Text
	 *
	 * @param   {String} type Method type
	 * @param   {Object} vars Variables to be merged
	 * @returns {String} Template output
	 */
	_docTemplate: function (type, vars) {
		var tmp = api_blueprint.api_doc_templates[type];

		_.forEach(vars, function (val, key) {
			tmp = tmp.replace(new RegExp('{' + key + '}', 'g'), val);
		});

		return tmp;
	},

	convertType: function (type) {
		type = type.toLowerCase();

		if (type == 'objectid') {
			type = 'object';
		}

		return type;
	},

	convertDefault: function (value) {
		if (typeof (value) == 'string' && value == '') {
			return "''";
		}

		if (!value) {
			return "''";
		}

		return value;
	}
};

/**
 * @constructor
 */
function KeystoneRest() {
	var self = this;

	/**
	 * 	Root of the API
	 */
	var apiRoot = '/api/';

	var api_doc = {};

	// Mongoose instance attached to keystone object.
	// Assigned in addRoutes
	var mongoose,
		keystone;

	/**
	 * Array containing routes and handlers
	 * @type {Array}
	 */

	self.routes = [];


	/**
	 * Send a 404 response
	 * @param  {Object} res     Express response
	 * @param  {String} message Message
	 */
	var _send404 = function (res, message) {
		res.status(404);
		res.json({
			status: 'missing',
			message: message
		});
	};


	/**
	 * Send an error response
	 * @param {Object} err Error response object
	 * @param {Object} res Express response
	 */
	var _sendError = function (err, req, res, next) {
		/*jslint unparam: true */
		next(err);
	};


	/**
	 * Convert fields that are relationships to _ids
	 * @param {Object} model instance of mongoose model
	 */
	var _flattenRelationships = function (model, body) {
		_.each(body, function (field, key) {
			var schemaField = model.schema.paths[key];

			// return if value is a string
			if (typeof field === 'string' || !schemaField || _.isEmpty(schemaField)) {
				return;
			}

			if (schemaField.options.ref) {
				body[key] = field._id;
			}

			if (_.isArray(schemaField.options.type)) {
				if (schemaField.options.type[0].ref) {
					_.each(field, function (value, i) {
						if (typeof value === 'string' || !value) {
							return;
						}
						body[key][i] = value._id;
					});
				}
			}
		});
	};


	/**
	 * Get list of selected fields based on options in schema
	 *
	 * @param {Schema} schema Mongoose schema
	 */
	var _getSelectedFieldsArray = function (schema) {
		var selected = [];

		_.each(schema.paths, function (path) {
			if (path.options.restSelected !== false) {
				selected.push(path);
			}
		});

		return selected;
	};

	/**
	 * Get list of selected fields based on options in schema
	 *
	 * @param {Schema} schema Mongoose schema
	 */
	var _getSelectedArray = function (schema) {
		/*var selected = [];

		_.each(schema.paths, function (path) {
			if (path.options.restSelected !== false) {
				selected.push(path.path);
			}
		});*/

		return _.pluck(_getSelectedFieldsArray(schema), 'path');
	};


	/**
	 * Get list of selected fields based on options in schema
	 * @param {Schema} schema Mongoose schema
	 */
	var _getSelected = function (schema) {
		return _getSelectedArray(schema).join(' ');
	};


	/**
	 * Get Uneditable
	 * @param {Schema} schema Mongoose schema
	 */
	var _getUneditable = function (schema) {
		var uneditable = [];

		_.each(schema.paths, function (path) {
			if (path.options.restEditable === false) {
				uneditable.push(path.path);
				return;
			}
			if (path.options.type.constructor.name === 'Array') {
				if (path.options.type[0].restEditable === false) {
					uneditable.push(path.path);
				}
			}
		});

		return uneditable;
	};


	/**
	 * Get name of reference model
	 * @param {Model}  Model Mongoose model
	 * @param {String} path Ref path to get name from
	 */
	var _getRefName = function (Model, path) {
		var options = Model.schema.paths[path].options;

		// One to one relationship
		if (options.ref) {
			return options.ref;
		}

		// One to many relationsihp
		return options.type[0].ref;
	};

	var _registerList = function (md) {
		// Check if Rest must be enabled
		try {
			if (md && md.options.rest) {
				// Register the model
				addRoutes(md, md.options.restOptions, md.restHooks, md.model.collection.name);
			} else {
				console.info('Rest is not enabled for ' + md.model.collection.name);
			}
		} catch (e) {
			console.info('Error registering List. Please verify');
			console.error(e);
		}
	};

	/**
	 * Register the models that has the Rest Option enabled
	 *
	 * @param {Object} app Keystone App
	 */
	var _registerRestModels = function (app) {
		// Get the models
		var keys = Object.keys(app.mongoose.models);

		for (var i = 0; i < keys.length; i++) {
			// Get the Keyston List
			var md = app.list(keys[i]);

			_registerList(md);
		}
	};

	/**
	 * Creates the documentation for an endpoint
	 *
	 * @param {String} method    The method to be created
	 * @param {Object} Model     The Model
	 */
	var _createDocumentation = function (method, Model) {
		var collectionName = Model.collection.name;

		// Defaults
		var vars = {
			name: collectionName,
			root: apiRoot,
			endpoint: collectionName.toLowerCase()
		};

		// create / update
		if (method == 'create' || method == 'update' || method == 'model') {
			var selecteds = _getSelectedFieldsArray(Model.schema);

			var attributes = [];
			_.forEach(selecteds, function (selected) {
				var tmp = api_blueprint.tab + '+ ' + selected.path;

				if (selected.instance != undefined) {
					tmp += ' (' + api_blueprint.convertType(selected.instance) + ( selected.isRequired ? ', required' : '' ) + ')';
				}
				
				if( _.has(selected, 'enumValues') && _.isArray(selected.enumValues) && selected.enumValues.length > 0 ) {
					tmp += api_blueprint.new_line + api_blueprint.tab + api_blueprint.tab + '+ Options: ' + selected.enumValues.join(', ');
				}

				if (_.has(selected.options, 'default') && typeof (selected.options.default) != 'Function') {
					tmp += api_blueprint.new_line + api_blueprint.tab + api_blueprint.tab + '+ Default: ' + api_blueprint.convertDefault(selected.options.default);
				}

				if (_.has(selected.options, 'ref')) {
					tmp += api_blueprint.new_line + api_blueprint.tab + api_blueprint.tab + '+ Reference: ' + selected.options.ref;
				}

				attributes.push(tmp);
			});

			vars['attributes'] = attributes.join(api_blueprint.new_line);
		}

		api_doc[collectionName.toLowerCase()][method] = api_blueprint._docTemplate(method, vars);
	};

	/**
	 * Add get route
	 * @param {Model}  model      Mongoose Model
	 * @param {Mixed}  middleware Express middleware to execute before route handler
	 * @param {String} selected   String passed to mongoose "select" method
	 */
	var _addList = function (Model, middleware, selected, relationships) {
		// Create Docs
		_createDocumentation('list', Model);

		// Get a list of items
		self.routes.push({
			method: 'get',
			middleware: middleware,
			route: apiRoot + Model.collection.name.toLowerCase(),
			handler: function (req, res, next) {
				var populated = req.query.populate ? req.query.populate.split(',') : [],
					criteria = _.omit(req.query, ['populate', '_', 'limit', 'skip', 'sort', 'select']),
					querySelect;

				if (req.query.select) {
					querySelect = req.query.select.split(',');
					querySelect = querySelect.filter(function (field) {
						return (selected.indexOf(field) > -1);
					}).join(' ');
				}

				Model.find().count(function (err, count) {
					if (err) {
						return _sendError(err, req, res, next);
					}

					var query = Model.find(criteria).skip(req.query.skip)
						.limit(req.query.limit)
						.sort(req.query.sort)
						.select(querySelect || selected);

					populated.forEach(function (path) {
						query.populate({
							path: path,
							select: _getSelected(mongoose.model(_getRefName(Model, path)).schema)
						});
					});

					query.exec(function (err, response) {
						if (err) {
							return _sendError(err, req, res, next);
						}

						// Make total total accessible via response headers
						res.setHeader('total', count);
						res.json(response);
					});
				});
			}
		});


		// Get a list of relationships
		if (relationships) {

			_.each(relationships, function (relationship) {
				self.routes.push({
					method: 'get',
					middleware: [],
					route: apiRoot + Model.collection.name.toLowerCase() + '/:id/' + relationship,
					handler: function (req, res, next) {
						Model.findById(req.params.id).exec(function (err, result) {
							var total,
								criteria = _.omit(req.query, ['populate', '_', 'limit', 'skip', 'sort', 'select']),
								ref,
								query,
								querySelect,
								refSelected,
								sortedResults = [];

							if (err && err.type !== 'ObjectId') {
								return _sendError(err, req, res, next);
							}
							if (!result) {
								return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id);
							}

							total = result[relationship].length;
							ref = Model.schema.paths[relationship].caster.options.ref;

							refSelected = _getSelected(mongoose.model(ref).schema);

							query = mongoose.model(ref)
								.find(criteria)
								.in('_id', result[relationship])
								.limit(req.query.limit)
								.skip(req.query.skip)
								.sort(req.query.sort);

							if (req.query.select) {
								querySelect = req.query.select.split(',');
								querySelect = querySelect.filter(function (field) {
									return (refSelected.indexOf(field) > -1);
								}).join(' ');
								query.select(querySelect);
							}

							if (req.query.populate && typeof req.query.populate === 'string') {
								query.populate(req.query.populate);
							}

							query.exec(function (err, response) {
								if (err) {
									return _sendError(err, req, res, next);
								}

								// Put relationship results into same order
								// that they appear in document
								if (!req.query.sort) {
									result[relationship].forEach(function (_id, i) {
										sortedResults[i] = _.findWhere(response, {
											_id: _id
										});
									});
									response = sortedResults;
								}

								// Make total total accessible via response headers
								res.setHeader('total', total);
								res.json(response);
							});
						});
					}
				});
			});
		}
	};


	/**
	 * Add list route
	 * @param {Model}  model      Mongoose Model
	 * @param {Mixed}  middleware Express middleware to execute before route handler
	 * @param {String} selected   String passed to mongoose "select" method
	 */

	var _addShow = function (Model, middleware, selected, findBy) {
		// Create Docs
		_createDocumentation('show', Model);

		var collectionName = Model.collection.name.toLowerCase();
		var paramName = Model.modelName.toLowerCase();

		// Get one item
		self.routes.push({
			method: 'get',
			middleware: middleware,
			route: apiRoot + collectionName + '/:' + paramName,
			handler: function (req, res, next) {
				var populated = req.query.populate ? req.query.populate.split(',') : [];
				var criteria = {};
				var querySelect;

				if (req.query.select) {
					querySelect = req.query.select.split(',');
					querySelect = querySelect.filter(function (field) {
						return (selected.indexOf(field) > -1);
					}).join(' ');
				}

				criteria[findBy] = req.params[paramName];

				var query = Model.findOne(criteria)
					.select(querySelect || selected);

				populated.forEach(function (path) {
					query.populate({
						path: path,
						select: _getSelected(mongoose.model(_getRefName(Model, path)).schema)
					});
				});

				query.exec(function (err, result) {
					if (err && err.type !== 'ObjectId') {
						return _sendError(err, req, res, next);
					}
					if (!result) {
						return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id);
					}
					res.json(result);
				});
			}
		});
	};


	/**
	 * Add post route
	 * @param {Model}  Model      Mongoose Model
	 * @param {Mixed}  middleware Express middleware to execute before route handler
	 * @param {String} selected   String passed to mongoose "select" method
	 */

	var _addCreate = function (Model, middleware, selected) {
		// Create Docs
		_createDocumentation('create', Model);

		// Create a new item
		self.routes.push({
			method: 'post',
			middleware: middleware,
			route: apiRoot + Model.collection.name.toLowerCase(),
			handler: function (req, res, next) {
				var item;

				_flattenRelationships(Model, req.body);

				var md = new Model();
				var options = {
					flashErrors: false,
					ignoreNoedit: true
				};
				
				// Get the UpdateHandler from Keystone and process the Request
				md.getUpdateHandler(req).process(req.body, options, function (err, item) {
					console.error(err);
					console.info(item);
					if (err) {
						return _sendError(err, req, res, next);
					}
					res.json(item);
				});
			}
		});
	};


	/**
	 * Add put route
	 * @param {Model}  Model      Mongoose Model
	 * @param {Mixed}  middleware Express middleware to execute before route handler
	 * @param {String} selected   String passed to mongoose "select" method
	 * @param {Array}  uneditable Array of fields to remove from post
	 */

	var _addUpdate = function (Model, middleware, uneditable, selected, findBy) {
		// Create Docs
		_createDocumentation('update', Model);

		var collectionName = Model.collection.name.toLowerCase();
		var paramName = Model.modelName.toLowerCase();
		var versionKey = Model.schema.options.versionKey;

		var handler = function (req, res, next) {
			var populated = req.query.populate ? req.query.populate.split(',') : '';
			var criteria = {};
			var querySelect;

			if (req.query.select) {
				querySelect = req.query.select.split(',');
				querySelect = querySelect.filter(function (field) {
					return (selected.indexOf(field) > -1);
				}).join(' ');
			}

			criteria[findBy] = req.params[paramName];

			_flattenRelationships(Model, req.body);
			req.body = _.omit(req.body, uneditable);

			Model.findOne(criteria).exec(function (err, item) {

				/*jslint unparam: true */
				if (err && err.type !== 'ObjectId') {
					return _sendError(err, req, res, next);
				}
				if (!item) {
					return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id);
				}

				if (req.body[versionKey] < item[versionKey]) {
					return _sendError(new mongoose.Error.VersionError(), req, res, next);
				}

				//_.extend(item, req.body); // Not sure about extending with UpdateHandler
				
				// Get the UpdateHandler and update
				item.getUpdateHandler(req).process(req.body, {
					flashErrors: false
				}, function (err, item) {
					if (err) {
						return _sendError(err, req, res, next);
					}

					Model.findOne(criteria).select(querySelect || selected).populate(populated).exec(function (err, item) {
						if (err) {
							return _sendError(err, req, res, next);
						}
						res.json(item);
					});
				});
			});
		};

		// Update an item having a given key
		self.routes.push({
			method: 'put',
			middleware: middleware,
			route: apiRoot + collectionName + '/:' + paramName,
			handler: handler
		});

		self.routes.push({
			method: 'patch',
			middleware: middleware,
			route: apiRoot + collectionName + '/:' + paramName,
			handler: handler
		});
	};


	/**
	 * Add delete route
	 * @param {Model} model      Mongoose Model
	 * @param {Mixed} middleware Express middleware to execute before route handler
	 */

	var _addDelete = function (Model, middleware, findBy) {
		// Create Docs
		_createDocumentation('delete', Model);

		var collectionName = Model.collection.name.toLowerCase();
		var paramName = Model.modelName.toLowerCase();

		// Delete an item having a given id
		self.routes.push({
			method: 'delete',
			middleware: middleware,
			route: apiRoot + collectionName + '/:' + paramName,
			handler: function (req, res, next) {
				var criteria = {};

				criteria[findBy] = req.params[paramName];

				// First find so middleware hooks (pre,post) will execute
				Model.findOne(criteria, function (err, item) {
					if (err && err.type !== 'ObjectId') {
						return _sendError(err, req, res, next);
					}
					if (!item) {
						return _send404(res, 'Could not find ' + Model.collection.name.toLowerCase() + ' with id ' + req.params.id);
					}

					item.remove(function (err) {
						if (err) {
							return _sendError(err, req, res, next);
						}
						res.json({
							message: 'Successfully deleted ' + collectionName
						});
					});
				});
			}
		});
	};


	/**
	 * Add routes
	 *
	 * @param {Object} keystoneList  Instance of KeystoneList
	 * @param {String} methods       Methods to expose('list show create update delete')
	 * @param {Object} middleware    Map containing middleware to execute for each action ({ list: [middleware] })
	 * @param {String} relationships Space separated list of relationships to build routes for
	 */

	var addRoutes = function (keystoneList, methods, middleware, relationships) {
		// Get reference to mongoose for internal use
		mongoose = keystone.mongoose;

		var findBy;
		var Model = keystoneList.model;

		if (!Model instanceof mongoose.model) {
			throw new Error('keystoneList is required');
		}
		if (!methods) {
			throw new Error('Methods are required');
		}
		if (!mongoose) {
			throw new Error('Keystone must be initialized before attempting to add routes');
		}

		var collectionName = Model.collection.name;
		if (!_.has(api_doc, collectionName.toLowerCase())) {
			api_doc[collectionName.toLowerCase()] = {};
			
			_createDocumentation('model', Model);
		}

		var selected = _getSelected(Model.schema),
			uneditable = _getUneditable(Model.schema),
			listMiddleware,
			showMiddleware,
			createMiddleware,
			updateMiddleware,
			deleteMiddleware;

		methods = methods.split(' ');

		// Use autoKey to find doc if it exists
		if (keystoneList.options.autokey) {
			findBy = keystoneList.options.autokey.path;
		} else {
			findBy = '_id';
		}

		// Set up default middleware
		middleware = middleware || {};
		listMiddleware = middleware.list || [];
		showMiddleware = middleware.show || [];
		createMiddleware = middleware.create || [];
		updateMiddleware = middleware.update || [];
		deleteMiddleware = middleware.delete || [];

		relationships = relationships ? relationships.split(' ') : [];

		if (methods.indexOf('list') !== -1) {
			_addList(Model, listMiddleware, selected, relationships);
		}
		if (methods.indexOf('show') !== -1) {
			_addShow(Model, showMiddleware, selected, findBy);
		}
		if (methods.indexOf('create') !== -1) {
			_addCreate(Model, createMiddleware, selected);
		}
		if (methods.indexOf('update') !== -1) {
			_addUpdate(Model, updateMiddleware, uneditable, selected, findBy);
		}
		if (methods.indexOf('delete') !== -1) {
			_addDelete(Model, deleteMiddleware, findBy);
		}
	};

	/**
	 * Register a Keystone List manually.
	 *
	 * @param {Object} list Object of Type Keystone List
	 */
	this.registerList = function (list) {
		_registerList(list);
	};


	/**
	 * Creates Rest
	 *
	 * @param  {Object} app Keystone instance
	 */

	this.createRest = function (kref, options) {
		keystone = kref; // Get the app reference of Keystone

		if (options == undefined) {
			options = {};
		};

		if (_.has(options, 'apiRoot') && options.apiRoot != '') {
			apiRoot = options.apiRoot;
		}

		// Get and register the models
		_registerRestModels(keystone);

		keystone.set('routes', app => {
			_.each(self.routes, function (route) {
				app[route.method](route.route, route.middleware, route.handler);
			});
		});
	};

	/**
	 * Returns the API Docs for the API Created
	 *
	 * @returns {String} The Blueprint formatted API
	 */
	this.apiDocs = function () {
		var md_doc = [];

		_.forEach(api_doc, function (model_doc, key) {
			var documentation = [];

			_.forEach(model_doc, function (doc, k) {
				documentation.push(doc);
			});

			md_doc.push(documentation.join((api_blueprint.new_line + api_blueprint.new_line)));
		});

		return md_doc.join((api_blueprint.new_line + api_blueprint.new_line));
	};
}

/*
 ** Exports
 */

module.exports = new KeystoneRest();
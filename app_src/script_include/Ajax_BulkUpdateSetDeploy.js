var Ajax_BulkUpdateSetDeploy = Class.create();
Ajax_BulkUpdateSetDeploy.prototype = Object.extendsObject(AbstractAjaxProcessor, {

    retrieveRemoteUpdateSets : function(params_obj){
        var result = '';
        
        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  
           

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            
            var usd = new BulkUpdateSetDeployer();
            
           
            // fetch remote upodate sets
            if (_.has(params_obj, 'remote-host') && this.isValidSysId (params_obj['remote-host'])){
                result = usd.retrieveRemoteUpdateSets(params_obj['remote-host']);
            }
        }
        catch(e){
            result.error = e.message;
        }    
        if(encode_answer){
            result = json.encode({'worker_id': result});
        } 
        
        return result;
    },
    
    /**
      valid sys_id is alpha numeric only and 32 chars
      @method isValidSysId
      @param {string} str
      @returns {boolean}
    */
    isValidSysId : function(str){
        var result = false;
        var regex = /^[a-zA-Z0-9]+$/;
        if (_.isString(str) && str.length === 32 && regex.test(str)){
            result = true;
        }
        return result;
    },

    /**
      @method getLogOutput
      @param {string} params_obj {'created_after_date': [date string]}
    */
    getLogOutput : function(params_obj){
        var result = []; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        if (_.has(params_obj, 'created_after_date') && _.isString(params_obj.created_after_date)){
            var usd = new BulkUpdateSetDeployer();
            result = usd.getLogOutput(params_obj.created_after_date);
        }
        
        if (encode_answer){
            return json.encode({'logs': result});
        }
        else{
            return result;
        }
    }, 


    /**
      @method isProgressWorkerCompleted
      @param {object} params_obj
    */
    isProgressWorkerCompleted : function(params_obj){
        var result = { 'completed': false }; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        if (_.has(params_obj, 'worker_id') && _.isString(params_obj.worker_id)){
            result.worker_id = params_obj.worker_id;
            var usd = new BulkUpdateSetDeployer();
            if (usd.checkWorkerState(params_obj.worker_id)){
                result.completed = true;
            }
        }
        
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    }, 


    /**
      @method deleteRetrievedUpdateSets
      @param {string} params_obj {'created_after_date': [date string], 'release_date': [date string],}
    */
    deleteRetrievedUpdateSets : function(params_obj){
        var result = {};
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        if (_.has(params_obj, 'created_after_date') || _.has(params_obj, 'release_date')){
            var dru = new DeleteRetrievedUpdateSets(); 

            result.targets =  dru.getMatching(params_obj.created_after_date, params_obj.release_date, params_obj['name-contains'], params_obj['name-does-not-contain']); 
            if (result.targets.length){
                
                var worker = new GlideScriptedProgressWorker(); 
                worker.setProgressName('Delete Retrieved Update Sets'); 
                worker.setName('DeleteRetrievedUpdateSets'); 
                worker.addParameter(params_obj.created_after_date); 
                worker.addParameter(params_obj.release_date); 
                worker.addParameter(params_obj['name-contains']);
                worker.addParameter(params_obj['name-does-not-contain']);
                worker.setBackground(true); 
                result.worker_id = worker.getProgressID(); 
                worker.start(); 
                worker.setProgressMessage('Deleting matching entries from sys_remote_update_set');
            }
            else{
                result.worker_id = '';
            }
        }
        
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    },     
    
    
    
    
    /**
      @method getRetrievedUpdateSets
      @param {string} params_obj {'created_after_date': [date string], 'release_date': [date string],}
    */
    getRetrievedUpdateSets : function(params_obj){
        var result = []; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        
        if (_.has(params_obj, 'created_after_date') || _.has(params_obj, 'release_date')){
            var usd = new BulkUpdateSetDeployer();
            result = usd.getRetrievedUpdateSets(params_obj.created_after_date, params_obj.release_date, params_obj['name-contains'], params_obj['name-does-not-contain']);
        }
        
        if (encode_answer){
            return json.encode({'update_sets': result});
        }
        else{
            return result;
        }
    },     
    
    
    /**
      start update set preview for all remote update sets retrieved after target date (or matching release date)
      returnm progress worker id
      @method previewRetrievedUpdateSets
      @param {object} object containingcreated by or release date
      @return {object} list of progress workers, and the update set preview transaction id
    */
    previewRetrievedUpdateSets : function(params_obj){
        var result = {'workers': [], 'transaction_id': ''};

        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  
           

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            
            var usd = new BulkUpdateSetDeployer();
            
                        
            // preview retrieved upodate sets
            if (_.has(params_obj, 'created_after_date') && _.has(params_obj, 'release_date') ){
                result.workers = usd.previewUpdateSets(params_obj.created_after_date, params_obj.release_date, params_obj['name-contains'], params_obj['name-does-not-contain']);
                result.transaction_id = usd.getTransactionId();
            }
        }
        catch(e){
            result.error = e.message;
        }  
        
        if(encode_answer){
            return json.encode(result);
        } 
        else{
            return result;
        } 
    },
    
    
    /**
      start update set commit for matching update sets by sys_id
      returnm progress worker ids
      @method commitPreviewedUpdateSets 
      @param {object} object containing array of remote update set sysids under the key 
      @return {object} list of progress workers, and the update set preview transaction id
    */
    commitPreviewedUpdateSets : function(params_obj){
        var result = {'committed': []};

        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }
            
            var usd = new BulkUpdateSetDeployer();
            usd.config.set('transaction_id', gs.generateGUID());
            gs.log('auto commit start ', this.type);
            // commit update sets 
            if ( _.has(params_obj, 'update_set_sys_ids') && _.isArray(params_obj.update_set_sys_ids) ){
                _.each(params_obj.update_set_sys_ids, function(v, k){
                    var obj = usd.commitRemoteUpdateSet(v);
                    //gs.log(v+' commit result: '+json.encode(obj),this.type);
                    if (_.has(obj, 'worker_id') && _.has(obj, 'local_sys_id')){
                        result.committed.push(obj);
                    }
                }, this);
            }
        }
        catch(e){
            result.error = e.message;
        }  
        
        if(encode_answer){
            return json.encode(result);
        } 
        else{
            return result;
        } 
    },
    
    
    /**
      check if all the worker sys ids are in the completed state
      @method areAllWorkersCompleted
      @param {object} contains keys "start_time", 'transaction_id', and "workers". workers is an array of worker sysid 
      @returns {boolean}
    */
    areAllWorkersCompleted : function(params_obj){
        var result = {'answer' : false};
        var completed_count = 0;
        var json = new JSON();
        var encode_answer = false;
        
        try{
            gs.include('underscorejs.min');  

            // used for testing from background script module
            if (!params_obj){
                params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
                encode_answer = true;
                
            }

            if (_.has(params_obj, 'start_time') && _.isString(params_obj.start_time) ){
                var usd = new BulkUpdateSetDeployer();
                usd.setStartTime(params_obj.start_time);
                // preview retrieved update sets
                if (_.has(params_obj, 'workers') && _.has(params_obj, 'transaction_id') ){
                    completed_count = usd.getCompletedWorkerCountByTransaction(params_obj.transaction_id);
                    gs.print(_.isArray(params_obj.workers));
                    if (_.isArray(params_obj.workers) && completed_count >= params_obj.workers.length  ){
                        result.answer = true;
                        
                    }
                }
            }
        }
        catch(e){
            result.error = e.message;
        }    
        if(encode_answer){
            return json.encode(result);
        } 
        else {
            return result;
        }        
    },
    
    
    /**
      get the report for the remote update sets in the parameter list
      @method getPreviewReport
      @param {string} params_obj {'start_time': '<process start time>', 'sys_ids': [remote_update_set_sys_id1, ...]}
    */
    getPreviewReport : function(params_obj){
        var result = []; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        if (_.has(params_obj, 'start_time') && _.isString(params_obj.start_time) ){
            var usd = new BulkUpdateSetDeployer();
            usd.setStartTime(params_obj.start_time);
            if (_.has(params_obj, 'sys_ids') || _.isArray(params_obj.sys_ids)){
                _.each(params_obj.sys_ids, function(v,k){
                    var report = usd.getUpdatesetPreviewReport(v);
                    if (_.keys(report).length){
                        result.push(report);
                    }
                    
                    // else - no report found 
                   
                });
            }
        }
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    }, 
    
    /**
      @method getCommitLogs
      @param {object} params_obj contains key "local_updateset_sysids", array of sysids for commited local update sets
    */
    getCommitLogs : function(params_obj){
        var result = {}; 
        var json = new JSON();
        gs.include('underscorejs.min'); 
        var encode_answer = false;
        if (!params_obj){
            params_obj =  json.decode(this.getParameter('sysparm_data')) || {};
            encode_answer = true;
            
        }
        if (_.has(params_obj, 'local_updateset_sysids') && _.isArray(params_obj.local_updateset_sysids) ){
            _.each(params_obj.local_updateset_sysids, function(v,k){
                var logs = [];
                var gr = new GlideRecord('sys_update_set_log');
                gr.addQuery('update_set', v);
                gr.query();
                while (gr.next()){
                    var obj = {
                       'status': gr.status.getDisplayValue(),  
                       'log' : gr.log.getDisplayValue(),
                       'created' : gr.sys_created_on.getDisplayValue(),
                    };
                    logs.push(obj);
                }
                if (logs.length){
                    // save the logs under the local update set sys_id key
                    result[v] = logs;
                }
                
            });
        }
        if (encode_answer){
            return json.encode(result);
        }
        else{
            return result;
        }
    }, 
    
    
    
    
    /**
      get timestamp in users timezone
      @method getTimeStamp
     
    */
    getTimeStamp : function(){
        
        var datetime = gs.nowDateTime();
        var date = datetime.substring(0,10);
        var time = datetime.substring(11);
        var result = {'date' : date, 'time': time, 'datetime': datetime};
        var json = new JSON();
        
        return json.encode(result);
        
    },
    
    type: 'Ajax_BulkUpdateSetDeploy',
});

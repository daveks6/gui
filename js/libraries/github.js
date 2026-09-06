/**
 * Github interface library.
 */
function loadGithubReleases(url) {
    
    var dfd = $.Deferred();
     
    $.ajax({
        dataType : "json",
        url : url,
        success : function(data, textStatus, request) {
            var temp = [];
            var link = request.getResponseHeader('Link');
            Array.prototype.push.apply(temp, data);
            if (link == null) {
               //callback(temp);
            } else {
                console.log("TODO: Paging!");
               //callback(temp);
            }
            dfd.resolve(temp);
        },
        error: function(data) {
			console.log("Error loading " + url);
			dfd.resolve([]);
		}
    });
    
    return dfd.promise();
}

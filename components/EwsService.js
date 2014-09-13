
var EXPORTED_SYMBOLS = ["EwsService"];

function EwsService() {}


EwsService.prototype.setCredentials = function(username, password) {

};

EwsService.prototype.setEwsUrl = function(url) {

};

EwsService.prototype.setAutoDiscoverUrl = function(url) {

};

EwsService.prototype.getRootFolder = function() {
	return null;
};

EwsService.prototype.findFolders = function(parentFolder) {
	return null;
}

////////////////Folder class////////////////////
EwsService.Folder = function() {

};
EwsService.Folder.prototype.getDisplayName = function() {

};
EwsService.Folder.prototype.setDisplayName = function(name) {

};

EwsService.Folder.prototype.getChildFolderCount = function() {

};
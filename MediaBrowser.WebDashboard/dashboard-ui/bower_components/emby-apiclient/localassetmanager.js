define(["filerepository","itemrepository","useractionrepository","transfermanager","cryptojs-md5"],function(filerepository,itemrepository,useractionrepository,transfermanager){"use strict";function getLocalItem(serverId,itemId){return itemrepository.get(serverId,itemId)}function recordUserAction(action){return action.Id=createGuid(),useractionrepository.set(action.Id,action)}function getUserActions(serverId){return useractionrepository.getByServerId(serverId)}function deleteUserAction(action){return useractionrepository.remove(action.Id)}function deleteUserActions(actions){var results=[];return actions.forEach(function(action){results.push(deleteUserAction(action))}),Promise.all(results)}function getServerItems(serverId){return itemrepository.getAll(serverId)}function getItemsFromIds(serverId,ids){var actions=ids.map(function(id){var strippedId=stripStart(id,"local:");return getLocalItem(serverId,strippedId)});return Promise.all(actions).then(function(items){var libItems=items.map(function(locItem){return locItem.Item});return Promise.resolve(libItems)})}function getViews(serverId,userId){return itemrepository.getServerItemTypes(serverId,userId).then(function(types){var item,list=[];return types.indexOf("audio")>-1&&(item={Name:"Music",ServerId:serverId,Id:"localview:MusicView",Type:"MusicView",CollectionType:"music",IsFolder:!0},list.push(item)),types.indexOf("photo")>-1&&(item={Name:"Photos",ServerId:serverId,Id:"localview:PhotosView",Type:"PhotosView",CollectionType:"photos",IsFolder:!0},list.push(item)),types.indexOf("episode")>-1&&(item={Name:"TV",ServerId:serverId,Id:"localview:TVView",Type:"TVView",CollectionType:"tvshows",IsFolder:!0},list.push(item)),types.indexOf("movie")>-1&&(item={Name:"Movies",ServerId:serverId,Id:"localview:MoviesView",Type:"MoviesView",CollectionType:"movies",IsFolder:!0},list.push(item)),types.indexOf("video")>-1&&(item={Name:"Videos",ServerId:serverId,Id:"localview:VideosView",Type:"VideosView",CollectionType:"videos",IsFolder:!0},list.push(item)),types.indexOf("musicvideo")>-1&&(item={Name:"Music Videos",ServerId:serverId,Id:"localview:MusicVideosView",Type:"MusicVideosView",CollectionType:"videos",IsFolder:!0},list.push(item)),Promise.resolve(list)})}function getTypeFilterForTopLevelView(parentId){var typeFilter=null;switch(parentId){case"localview:MusicView":typeFilter="MusicAlbum";break;case"localview:PhotosView":typeFilter="PhotoAlbum";break;case"localview:TVView":typeFilter="Series";break;case"localview:VideosView":typeFilter="Video";break;case"localview:MoviesView":typeFilter="Movie";break;case"localview:MusicVideosView":typeFilter="MusicVideo"}return typeFilter}function normalizeId(id){return id?(id=stripStart(id,"localview:"),id=stripStart(id,"local:")):null}function getViewItems(serverId,userId,options){var parentId=options.ParentId,typeFilter=getTypeFilterForTopLevelView(parentId);parentId=normalizeId(parentId);var seasonId=normalizeId(options.SeasonId||options.seasonId),seriesId=normalizeId(options.SeriesId||options.seriesId),includeItemTypes=options.IncludeItemTypes?options.IncludeItemTypes.split(","):[];return typeFilter&&(parentId=null,includeItemTypes.push(typeFilter)),getServerItems(serverId).then(function(items){var resultItems=items.filter(function(item){if(item.SyncStatus&&"synced"!==item.SyncStatus)return!1;if(options.MediaType&&item.Item.MediaType!==options.MediaType)return!1;if(seriesId&&item.Item.SeriesId!==seriesId)return!1;if(seasonId&&item.Item.SeasonId!==seasonId)return!1;if("IsNotFolder"===options.Filters&&item.Item.IsFolder)return!1;if("IsFolder"===options.Filters&&!item.Item.IsFolder)return!1;if(includeItemTypes.length&&includeItemTypes.indexOf(item.Item.Type||"")===-1)return!1;if(options.Recursive);else if(parentId&&item.Item.ParentId!==parentId)return!1;return!0}).map(function(item2){return item2.Item});return"DateCreated"===options.SortBy&&resultItems.sort(function(a,b){return compareDates(a.DateCreated,b.DateCreated)}),options.Limit&&(resultItems=resultItems.slice(0,options.Limit)),Promise.resolve(resultItems)})}function removeObsoleteContainerItems(serverId){return getServerItems(serverId).then(function(items){var seriesItems=items.filter(function(item){var type=(item.Item.Type||"").toLowerCase();return"series"===type}),seasonItems=items.filter(function(item){var type=(item.Item.Type||"").toLowerCase();return"season"===type}),albumItems=items.filter(function(item){var type=(item.Item.Type||"").toLowerCase();return"musicalbum"===type||"photoalbum"===type}),requiredSeriesIds=items.filter(function(item){var type=(item.Item.Type||"").toLowerCase();return"episode"===type}).map(function(item2){return item2.Item.SeriesId}).filter(filterDistinct),requiredSeasonIds=items.filter(function(item){var type=(item.Item.Type||"").toLowerCase();return"episode"===type}).map(function(item2){return item2.Item.SeasonId}).filter(filterDistinct),requiredAlbumIds=items.filter(function(item){var type=(item.Item.Type||"").toLowerCase();return"audio"===type||"photo"===type}).map(function(item2){return item2.Item.AlbumId}).filter(filterDistinct),obsoleteItems=[];seriesItems.forEach(function(item){requiredSeriesIds.indexOf(item.Item.Id)<0&&obsoleteItems.push(item)}),seasonItems.forEach(function(item){requiredSeasonIds.indexOf(item.Item.Id)<0&&obsoleteItems.push(item)}),albumItems.forEach(function(item){requiredAlbumIds.indexOf(item.Item.Id)<0&&obsoleteItems.push(item)});var p=Promise.resolve();return obsoleteItems.forEach(function(item){p=p.then(function(){return itemrepository.remove(item.ServerId,item.Id)})}),p})}function removeLocalItem(localItem){return itemrepository.get(localItem.ServerId,localItem.Id).then(function(item){return filerepository.deleteFile(item.LocalPath).then(function(){var p=Promise.resolve(!0);return item.AdditionalFiles&&item.AdditionalFiles.forEach(function(file){p=p.then(function(){return filerepository.deleteFile(file.Path)})}),p.then(function(file){return itemrepository.remove(localItem.ServerId,localItem.Id)})},function(error){var p=Promise.resolve(!0);return item.AdditionalFiles&&item.AdditionalFiles.forEach(function(file){p=p.then(function(item){return filerepository.deleteFile(file.Path)})}),p.then(function(file){return itemrepository.remove(localItem.ServerId,localItem.Id)})})})}function addOrUpdateLocalItem(localItem){return itemrepository.set(localItem.ServerId,localItem.Id,localItem)}function createLocalItem(libraryItem,apiClient,jobItem){var localPath,path=getDirectoryPath(libraryItem,apiClient.serverName()),localFolder=filerepository.getFullLocalPath(path);if(jobItem&&(path.push(getLocalFileName(libraryItem,jobItem.OriginalFileName)),localPath=filerepository.getFullLocalPath(path)),libraryItem.MediaSources)for(var i=0;i<libraryItem.MediaSources.length;i++){var mediaSource=libraryItem.MediaSources[i];mediaSource.Path=localPath,mediaSource.Protocol="File"}var item={Item:libraryItem,ItemId:libraryItem.Id,ServerId:apiClient.serverId(),LocalPath:localPath,LocalFolder:localFolder,SyncDate:Date.now(),Id:libraryItem.Id};return jobItem&&(item.AdditionalFiles=jobItem.AdditionalFiles.slice(0),item.SyncJobItemId=jobItem.SyncJobItemId),Promise.resolve(item)}function getSubtitleSaveFileName(localItem,mediaPath,language,isForced,format){var name=getNameWithoutExtension(mediaPath);language&&(name+="."+language.toLowerCase()),isForced&&(name+=".foreign"),name=name+"."+format.toLowerCase();var localPathArray=[localItem.LocalFolder,name],localFilePath=filerepository.getPathFromArray(localPathArray);return localFilePath}function getItemFileSize(path){return filerepository.getItemFileSize(path)}function getNameWithoutExtension(path){var fileName=path,pos=fileName.lastIndexOf(".");return pos>0&&(fileName=fileName.substring(0,pos)),fileName}function downloadFile(url,localItem){var folder=filerepository.getLocalPath(),imageUrl=getImageUrl(localItem.Item.ServerId,localItem.Item.Id,{type:"Primary",index:0});return transfermanager.downloadFile(url,folder,localItem,imageUrl)}function downloadSubtitles(url,fileName){var folder=filerepository.getLocalPath();return transfermanager.downloadSubtitles(url,folder,fileName)}function getImageUrl(serverId,itemId,imageOptions){var imageType=imageOptions.type,index=imageOptions.index,pathArray=getImagePath(serverId,itemId,imageType,index),relPath=pathArray.join("/"),prefix="ms-appdata:///local";return prefix+"/"+relPath}function hasImage(serverId,itemId,imageType,index){var pathArray=getImagePath(serverId,itemId,imageType,index),localFilePath=filerepository.getFullMetadataPath(pathArray);return filerepository.fileExists(localFilePath).then(function(exists){return Promise.resolve(exists)},function(err){return Promise.resolve(!1)})}function fileExists(localFilePath){return filerepository.fileExists(localFilePath)}function downloadImage(localItem,url,serverId,itemId,imageType,index){var pathArray=getImagePath(serverId,itemId,imageType,index),localFilePath=filerepository.getFullMetadataPath(pathArray);localItem.AdditionalFiles||(localItem.AdditionalFiles=[]);var fileInfo={Path:localFilePath,Type:"Image",Name:imageType+index.toString(),ImageType:imageType};localItem.AdditionalFiles.push(fileInfo);var folder=filerepository.getMetadataPath();return transfermanager.downloadImage(url,folder,localFilePath)}function isDownloadFileInQueue(path){return transfermanager.isDownloadFileInQueue(path)}function getDownloadItemCount(){return transfermanager.getDownloadItemCount()}function getDirectoryPath(item,serverName){var parts=[];parts.push(serverName);var itemtype=item.Type.toLowerCase();if("episode"===itemtype){parts.push("TV");var seriesName=item.SeriesName;seriesName&&parts.push(seriesName);var seasonName=item.SeasonName;seasonName&&parts.push(seasonName)}else if("video"===itemtype)parts.push("Videos"),parts.push(item.Name);else if("audio"===itemtype){parts.push("Music");var albumArtist=item.AlbumArtist;albumArtist&&parts.push(albumArtist),item.AlbumId&&item.Album&&parts.push(item.Album)}else"photo"===itemtype&&(parts.push("Photos"),item.AlbumId&&item.Album&&parts.push(item.Album));for(var finalParts=[],i=0;i<parts.length;i++)finalParts.push(filerepository.getValidFileName(parts[i]));return finalParts}function getImagePath(serverId,itemId,imageType,index){var parts=[];parts.push("Metadata"),parts.push(serverId),parts.push("images"),index=index||0,parts.push(itemId+"_"+imageType+"_"+index.toString());for(var finalParts=[],i=0;i<parts.length;i++)finalParts.push(filerepository.getValidFileName(parts[i]));return finalParts}function getLocalFileName(item,originalFileName){var filename=originalFileName||item.Name;return filerepository.getValidFileName(filename)}function resyncTransfers(){return transfermanager.resyncTransfers()}function createGuid(){var d=(new Date).getTime();window.performance&&"function"==typeof window.performance.now&&(d+=performance.now());var uuid="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=(d+16*Math.random())%16|0;return d=Math.floor(d/16),("x"===c?r:3&r|8).toString(16)});return uuid}function startsWith(str,find){return!!(str&&find&&str.length>find.length&&0===str.indexOf(find))}function stripStart(str,find){return startsWith(str,find)?str.substr(find.length):str}function filterDistinct(value,index,self){return self.indexOf(value)===index}function compareDates(a,b){return isFinite(a=a.valueOf())&&isFinite(b=b.valueOf())?(a>b)-(a<b):NaN}return{getLocalItem:getLocalItem,recordUserAction:recordUserAction,getUserActions:getUserActions,deleteUserAction:deleteUserAction,deleteUserActions:deleteUserActions,removeLocalItem:removeLocalItem,addOrUpdateLocalItem:addOrUpdateLocalItem,createLocalItem:createLocalItem,downloadFile:downloadFile,downloadSubtitles:downloadSubtitles,hasImage:hasImage,downloadImage:downloadImage,getImageUrl:getImageUrl,getSubtitleSaveFileName:getSubtitleSaveFileName,getServerItems:getServerItems,getItemFileSize:getItemFileSize,isDownloadFileInQueue:isDownloadFileInQueue,getDownloadItemCount:getDownloadItemCount,getViews:getViews,getViewItems:getViewItems,resyncTransfers:resyncTransfers,getItemsFromIds:getItemsFromIds,removeObsoleteContainerItems:removeObsoleteContainerItems,fileExists:fileExists}});
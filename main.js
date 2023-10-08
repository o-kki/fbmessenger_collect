const { Client } = require('libfb');
const client = new Client()
const path = require("path");

/* stdout function */
// stdoutStruct : status, progress, data, code, errMessage
function stdout(stdoutStruct){
    if(stdoutStruct.status == "start") {
        console.log(`Start Collect Data`);
    } else if (stdoutStruct.status == "loading") {
        console.log(`progress=${stdoutStruct.progress}`);
    } else if (stdoutStruct.status == "end") {
        console.log(`data=${encodeURIComponent(stdoutStruct.data)}`);
    } else if (stdoutStruct.status == "error") {
        console.log(`status=${stdoutStruct.status}&message=${encodeURIComponent(stdoutStruct.errMessage)}&code=${stdoutStruct.code}`);
    }
}

/* files download */
var fs = require('fs-extra');
var fetch = require('node-fetch');

/* Make folder if not exist*/
function makeFolder(dir) {
    if(!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
}

/* Download a file to disk*/
function downloadFile(fileUrl, destPath) {
    if (!fileUrl) return Promise.reject(new Error('Invalid fileUrl'));
    if (!destPath) return Promise.reject(new Error('Invalid destPath'));

    return new Promise(function(resolve, reject) {
        fetch(fileUrl).then(function(res) {
            var fileStream = fs.createWriteStream(destPath);
            res.body.on('error', reject);
            fileStream.on('finish', resolve);
            res.body.pipe(fileStream);
        });
    });
}

/* Here defines the structure of message */
// |finalJSON| structure (which is top-level JSON)
function finalJSONStruct(){
    var result = new Object();
    result.service = "facebook_messenger";
    result.chatrooms = new Array();
    return result;
}

// |chatroom| structure
function chatroomStruct(){
    var cr = new Object();
    cr.chatroom_name = "";
    cr.chatroom_icon = "";
    cr.last_message = "";
    cr.last_message_time = "";
    cr.chats = new Array();
    return cr;
}

// |chats| structure
function chatStruct(chat_id="", is_read=null, is_owner=null, sender="", message_type="", original_type="", message_content="", message_time=""){
    var ch = new Object();
    ch.chat_id = chat_id;
    ch.is_read = is_read;
    ch.is_owner = is_owner;
    ch.sender = sender;
    ch.message_type = message_type;
    ch.original_type = original_type;
    ch.message_content = message_content;
    ch.message_time = message_time;
    return ch;
}

stdout({
    'status': 'start'
});

// Usage: node main.js ID PW PATH (splited with whitespace)
if(process.argv.length != 5){
    var errorMessage = "USAGE: node main.js <ID> <PW> <PATH>";
    stdout({
        'status': 'error',
        'errorMessage': errorMessage,
        'code': 100 // Error
    });
} else{
    /*id, password, db path etc*/
    var id = process.argv[2] ;
    var password = process.argv[3];
    var attachmentPath = process.argv[4]; // It needs escaping special charset

    const attachmentsPath = path.join(attachmentPath, 'attachments');
    const jsonPath = path.join(attachmentPath, 'json');
    makeFolder(attachmentsPath);
    makeFolder(jsonPath);

    /* Facebook login and get Data */
    client.login(id, password).then( async () => {
        
        session = await client.getSession();
        uid = session.tokens.uid
        usrInfo = await client.getUserInfo(uid);
        
        const userinfoPath = path.join(jsonPath, "userInfo.json");
        fs.writeFileSync(userinfoPath, JSON.stringify(usrInfo,null,2));

        // If login failed, exit.
        if(!client.loggedIn){
            var errorMessage = "Login Failed";
            stdout({
                'status': 'error',
                'message': errorMessage,
                'code': 101 // Login Error
            });
        } else {
            stdout({
                'status': "loading",
                'progress': 10
            });
            
            list = await client.getThreadList(10000); // Account Information
            fs.writeFileSync(userinfoPath, JSON.stringify(list,null,2));
    
            // Here is |finalJSON| structure
            var finalJSON = finalJSONStruct();
            thrCnt = list.length; // 대화방 갯수
            for(var i=0; i< thrCnt; i++){
    
                data = await client.getThreadInfo(list[i].id); // Thread ID
                fs.appendFileSync(path.join(jsonPath, "data.json"), JSON.stringify(data,null,2) + ",\n");
    
                particNum = data.participants.length; /*about participants name*/
                let numCallbackRuns = 0;
                var particNms = '' // Chat partitcipants
                data.participants.forEach(element => {
                    if(numCallbackRuns == 0){
                        particNms = element.name
                    }else{          
                        particNms += ', ' + element.name
                    }
                    numCallbackRuns++
                });
            
                msgBox = await client.getMessages(list[i].id, 10000); /*call facebook messages*/
                fs.appendFileSync(path.join(jsonPath, "msgBox.json"), JSON.stringify(msgBox,null,2) + ",\n");
    
                // Here is |chatroom| structure
                var chatroom = chatroomStruct();
                var conCnt = msgBox.length; // messages count
                for (var k=0; k <conCnt; k++){
    
                    var athrInfo = await client.getUserInfo(msgBox[k].authorId); 
                    if(athrInfo.name == ""){
                        athrInfo.name = "Deleted Accounts";
                    }
                    fs.appendFileSync(path.join(jsonPath, "athrInfo.json"), JSON.stringify(athrInfo,null,2) + ",\n");

                    function formatDateToCustomFormat(date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const hours = String(date.getHours()).padStart(2, '0');
                        const minutes = String(date.getMinutes()).padStart(2, '0');
                        const seconds = String(date.getSeconds()).padStart(2, '0');
                      
                        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                     }
                     
                    const date = new Date(msgBox[k].timestamp);
                    const formattedDate = formatDateToCustomFormat(date);
                    //const timestamp = new Date(msgBox[k].timestamp).toISOString(); //date format ISO 8601
                    const timestamp = formattedDate //YYY-MM-DD HH:MM:SS
                    const threadid = msgBox[k].threadId; // Thread Id
                    
                    /* Message Type */
                    attachGbn = msgBox[k].fileAttachments.length;
                    mediaGbn = msgBox[k].mediaAttachments.length;  
                        
                    if(attachGbn == 0 && mediaGbn == 0){ // Message Type: Message
                        messageBox = msgBox[k].message.replace("'","''");
    
                        // Here is |Chat| structure
                        var chat = chatStruct(
                            id=msgBox[k].id,
                            is_read=null,
                            is_owner=(usrInfo.id == athrInfo.id),
                            sender = athrInfo.name,
                            message_type = "text",
                            original_type = "text",
                            message_content = messageBox,
                            message_time = timestamp
                        );
                        chatroom.chats.push(chat);
                        /*db.run("INSERT INTO MS_FB_ChatData (id, sender, time, content, content_type, attachment, attachment_path, app)" +
                        "VALUES ('"+list[i].id+"', '"+name+"', '"+timestamp+"', '"+messageBox+"','messages',NULL, NULL,'FB_Messenger')");*/
    
    
                        if(k==conCnt-1){ // Insert last message information to |Chatroom| structure
                            chatroom.chatroom_id = list[i].id;
                            chatroom.chatroom_name = `${particNms}(${particNum})`; // Participants Name
                            chatroom.chatroom_icon = null;
                            chatroom.last_message = messageBox;
                            chatroom.last_message_time = timestamp;
                            /*db.run("INSERT INTO MS_FB_ChatRoom (id, participants, Num, LastSender, LastTime, LastContent, LastType)" +
                                "VALUES ('"+threadid+"', '"+particNms+"', '"+particNum+"', '"+name+"','"+timestamp+"','"+messageBox+"','message')");*/
                        }
    
    
                    }else{ // Message Type: attachments (mediaAttachments)
                        for(var b=0; b < msgBox[k].mediaAttachments.length; b++){    
                            if(msgBox[k].mediaAttachments[b] != undefined){     
                                mediaMsg = msgBox[k].mediaAttachments[b].message 
                                originType = msgBox[k].mediaAttachments[b].type

                                // Handling deleted message
                                if(originType == "UnavailableXMA") {
                                    mediaMsg = "[삭제된 메시지]";
                                    mediaType = null;
                                }
    
                                // Here is |Chat| structure
                                var chat = chatStruct(
                                    id=msgBox[k].id,
                                    is_read=null,
                                    is_owner=(usrInfo.id == athrInfo.id),
                                    sender = athrInfo.name,
                                    message_type = mediaType,
                                    original_type = originType,
                                    message_content = mediaMsg,
                                    message_time = timestamp
                                );
                                chatroom.chats.push(chat);
                                /* db.run("INSERT INTO MS_FB_ChatData (id, sender, time, content, content_type, attachment, attachment_path, app)" +
                                    "VALUES ('"+list[i].id+"', '"+name+"', '"+timestamp+"', '"+mediaMsg+"', '"+mediaType+"', NULL, NULL, 'FB_Messenger')");*/
                            }
    
                            if(k==conCnt-1){ // Insert last message information to |Chatroom| structure
                                chatroom.chatroom_id = list[i].id;
                                chatroom.chatroom_name = `${particNms}(${particNum})`; // 참가자 이름(참가자 숫자)
                                chatroom.chatroom_icon = null;
                                chatroom.last_message = mediaMsg;
                                chatroom.last_message_time = timestamp;
                                /* db.run("INSERT INTO MS_FB_ChatRoom (id, participants, Num, LastSender, LastTime, LastContent, LastType)" +
                                    "VALUES ('"+threadid+"', '"+particNms+"', '"+particNum+"', '"+name+"','"+timestamp+"','"+mediaMsg+"','"+mediaType+"')"); */
                            }
                        }
                        
                        for (var a=0; a< msgBox[k].fileAttachments.length; a++){ // Message Type: attachments (fileAttachments)
                            if(msgBox[k].fileAttachments[a] != undefined){
                                attachBox = await client.getAttachmentInfo(msgBox[k].id, msgBox[k].fileAttachments[b].id) // 추가
                                //var fileUrl = msgBox[k].fileAttachments[b].url;
                                //var fileNm = msgBox[k].fileAttachments[b].filename;
                                var fileUrl = attachBox.redirect_uri;
                                var fileNm = attachBox.filename;
                                if(fileUrl != undefined){
                                    if(!fileNm.includes('.')){
                                        var extension = '.' + msgBox[k].fileAttachments[b].mimeType.split('/')[1];
                                        fileNm += extension;
                                    }
                                    var downloadPath = path.join(attachmentsPath, fileNm);
                                    try{
                                        var downloadPromise = downloadFile(fileUrl, downloadPath);
                                    } catch {
                                        var warningMessage = `failed attachments: ${msgBox[k].fileAttachments[b]}`;
                                        console.log(`warning=${warningMessage}`);
                                    }        
                                }

                                if(msgBox[k].fileAttachments[a].mimeType == "image/gif") {
                                    mediaType = "sticker"
                                }else if(msgBox[k].fileAttachments[a].mimeType == "image/jpeg"){
                                    mediaType = "picture"
                                }else{
                                    mediaType = "attach"
                                }
    
                                // Here is |Chat| structure
                                var chat = chatStruct(
                                    id=msgBox[k].id,
                                    is_read=null,
                                    is_owner=(usrInfo.id == athrInfo.id),
                                    sender = athrInfo.name,
                                    message_type = mediaType,
                                    original_type = msgBox[k].fileAttachments[a].mimeType,
                                    message_content = downloadPath,
                                    message_time = timestamp
                                );
                                chatroom.chats.push(chat);
                                /* db.run("INSERT INTO MS_FB_ChatData (id, sender, time, content, content_type, attachment, attachment_path, app)" +
                                    "VALUES ('"+list[i].id+"', '"+name+"', '"+timestamp+"', '"+messageBox+"','"+msgBox[k].fileAttachments[a].mimeType+"',
                                    '"+msgBox[k].fileAttachments[a].filename+"','"+msgBox[k].fileAttachments[a].url+"','FB_Messenger')");*/
    
                                if(k==conCnt-1){ // Insert last message information to |Chatroom| structure
                                    chatroom.chatroom_id = list[i].id;
                                    chatroom.chatroom_name = `${particNms}(${particNum})`; // 참가자 이름(참가자 숫자)
                                    chatroom.chatroom_icon = null;
                                    chatroom.last_message = downloadPath;
                                    chatroom.last_message_time = timestamp;
                                    /* db.run("INSERT INTO MS_FB_ChatRoom (id, participants, Num, LastSender, LastTime, LastContent, LastType)" +
                                        "VALUES ('"+threadid+"', '"+particNms+"', '"+particNum+"', '"+name+"','"+timestamp+"','fileAttachments',
                                        '"+msgBox[k].fileAttachments[a].mimeType+"')");*/
                                }
                            }
                        }
                    }
                }
                // Insert |chatroom| in the finalJSON.chatrooms
                finalJSON.chatrooms.push(chatroom);

                
                var progress = 10 + 90 * ( (i + 1) / thrCnt);
                stdout({
                    'progress': Math.round(progress+'%')
                });
            }
            stdout({
                'data': JSON.stringify(finalJSON)
            });

            setTimeout(()=>{
                process.exit(6);
            }, 5000)
        }
    });
}


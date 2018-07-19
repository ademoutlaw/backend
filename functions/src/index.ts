import * as functions from 'firebase-functions';
import * as admin from "firebase-admin";
// const cors = require('cors')({origin: true});
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
// admin.initializeApp();
// export const helloBeego = functions.https.onRequest((request, response) => {
//     // console.log(request.auth);
//     cors(request, response,() => {

//         console.log(request['auth']);
//         admin.database().ref('category').on("value",data=>{
//             response.send(data);
//         });
//         // getCategory().then(data=>{
//         //     response.send(data)
//         // }).catch(e=>{
//         //     response.status(500).send(e)
//         // })

//     })


// });
// function getCategory(){
//     return new Promise((resolve, reject)=>{
//         admin.database().ref('category').on("value",data=>{
//             resolve(data);
//         });
//     })
// }

/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


// const functions = require('firebase-functions');
// const admin = require('firebase-admin');
admin.initializeApp();
const express = require('express');
// const cookieParser = require('cookie-parser')();
const bodyParser = require('body-parser');
const cors = require('cors')({ origin: true });
const app = express();

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        console.log("is have token " + idToken);
        if(idToken==="0"){
            req.user = null;
            console.log("is not connected ");
            return next();
        }
        console.log("is connected");
        admin.auth().verifyIdToken(idToken).then((decodedIdToken) => {
            req.user = decodedIdToken;
            return next();
        }).catch((error) => {
            res.status(403).send('Unauthorized:token!!');
            return;
        });
    } else {
        console.log("is don't have token");
        res.status(403).send('Unauthorized');
        return;
    }
    
};

app.use(cors);
app.use(bodyParser.json());
// app.use(cookieParser);
app.use(validateFirebaseIdToken);
app.get('/suggestedfriends', (req, res) => {
    // admin.database().ref('category').on("value", categories => {
    //     res.send({categories,email: req.user.email});
    // });
    
    if(req.user){
        const lastScore = req.query.lastScore||"";
        const method = req.query.method === "mutual"?"mutualScore":"nearbyScore";
        getSuggestedFriends(req.user.uid, method, lastScore).then( friends=>{
            res.send(friends);
        }).catch(e=>{
            console.log(e);
        });
        console.log("custom suggested friends by "+method);
    }else{
        admin.database().ref("users").once("value", data=>{
            console.log("get responce");
            const allFriends = [];
            const friends = data.val();
            console.log(friends);
            for (const key in friends) {
                allFriends.push({...friends[key], uid:key});
            }
            res.send(allFriends);
        }).then(e=>{
            console.log(e);
        }).catch(e=>{
            console.log(e);
        })
    }
    //         // getCategory().then(data=>{
    //         //     response.send(data)
    //         // }).catch(e=>{
    //         //     response.status(500).send(e)
    //         // })
});
app.get('/friend/:uid', (req, res) => {
    // admin.database().ref('category').on("value", categories => {
    //     res.send({categories,email: req.user.email});
    // });
    const uid = req.params.uid;
    console.log(uid);
    if(req.user){
        admin.database().ref(`users/${uid}`).once("value")
        .then( sfriends=>{
            res.send(sfriends);
        }).catch(e=>{
            console.log(e);
        })
    }else{
        admin.database().ref(`users/${uid}`).once("value", friends=>{
            res.send(friends);
        }).then(e=>{
            console.log(e);
        }).catch(e=>{
            console.log(e);
        })
    }
    //         // getCategory().then(data=>{
    //         //     response.send(data)
    //         // }).catch(e=>{
    //         //     response.status(500).send(e)
    //         // })
});
app.post('/friendrequest', (req, res) => {
    // admin.database().ref('category').on("value", categories => {
    //     res.send({categories,email: req.user.email});
    // });
    console.log("friendrequest========");
    if(req.user && req.body.uid){
        console.log("uid",req.user.uid)
        // console.log("frienduid",req.params.uid);
        console.log("frienduid",req.body.uid);
        // res.redirect(303, {friends:""}); 
        requestFriend(req.user.uid, req.body.uid).then( friends=>{
            res.send({done:'done'});
        }).catch(e=>{
            console.log(e);
        });
    }else{
        res.status(403).send('Unauthorized');
    }
    //         // getCategory().then(data=>{
    //         //     response.send(data)
    //         // }).catch(e=>{
    //         //     response.status(500).send(e)
    //         // })
});
app.post('/ignoreFriend', (req, res)=>{
    if(req.user && req.body.uid){
        console.log("uid",req.user.uid)
        // console.log("frienduid",req.params.uid);
        console.log("frienduid",req.body.uid);
        // res.redirect(303, {friends:""}); 
        ignoreSuggestedFriend(req.user.uid, req.body.uid).then( friends=>{
            res.send({done:'done'});
        }).catch(e=>{
            console.log(e);
        });
    }else{
        res.status(403).send('Unauthorized');
    }
});
async function getSuggestedFriends(uid:string, method, lastScore: string) {
    const startAt = (lastScore && lastScore!=="" && lastScore!=="undefined")?lastScore:"9";
    let includeIt = startAt==="9";
    const snapshot = await admin.database().ref(`suggestedFriends/${uid}`).orderByChild(method)
    .startAt(startAt)
    .endAt("9\uf8ff").limitToFirst(10).once("value");
    const friendList = [];
    const friendKeys = [];
    let  newLastScore;
    snapshot.forEach((child)=>{
        if(includeIt){
            friendKeys.push(child.key);
            newLastScore = child.val().nearbyScore;
        }else{
            includeIt = true;
        }
    });
    for (const friendKey of friendKeys) {
        const friendSnapshot = await admin.database().ref(`users/${friendKey}`).once("value")
        const friend = friendSnapshot.val();
        friend.uid = friendKey;
        friendList.push(friend);
    }
    return {friends:friendList,lastScore:newLastScore};
}
async function requestFriend(userId, friendId) {
    const update = {};
    update[`friends/${userId}/${friendId}/senderRequest`]=userId;
    update[`friends/${userId}/${friendId}/state`]="waitting";
    update[`friends/${friendId}/${userId}/senderRequest`]=userId;
    update[`friends/${friendId}/${userId}/state`]="request";
    const snapshot = await admin.database().ref(`suggestedFriends/${userId}/${friendId}`).once("value");
    const friend = snapshot.val();
    if(!friend){
        console.log(userId, friendId);
        return false;
    }else{
        console.log(friend);
    }
    const mutualScore = friend.mutualScore.split("_");
    const nearbyScore = friend.nearbyScore.split("_");
    update[`suggestedFriends/${friendId}/${userId}/mutualScore`] = 1+"_"+mutualScore[1]+"_"+mutualScore[2]+"_"+userId;
    update[`suggestedFriends/${friendId}/${userId}/nearbyScore`] = 1+"_"+nearbyScore[1]+"_"+nearbyScore[2]+"_"+userId;
    update[`suggestedFriends/${userId}/${friendId}/mutualScore`] = 1+"_"+mutualScore[1]+"_"+mutualScore[2]+"_"+friendId;
    update[`suggestedFriends/${userId}/${friendId}/nearbyScore`] = 1+"_"+nearbyScore[1]+"_"+nearbyScore[2]+"_"+friendId;
    await admin.database().ref('/').update(update);
    return true;
}
async function ignoreSuggestedFriend(userId, friendId) {
    const update = {};
    const snapshot = await admin.database().ref(`suggestedFriends/${userId}/${friendId}`).once("value");
    const friend = snapshot.val();
    if(!friend){
        console.log(userId, friendId);
        return false;
    }else{
        console.log(friend);
    }
    const mutualScore = friend.mutualScore.split("_");
    const nearbyScore = friend.nearbyScore.split("_");
    let sugg = parseInt(mutualScore[1]);
    sugg = sugg++<9?sugg:9;
    update[`suggestedFriends/${friendId}/${userId}/mutualScore`] = mutualScore[0]+"_"+sugg+"_"+mutualScore[2]+"_"+userId;
    update[`suggestedFriends/${friendId}/${userId}/nearbyScore`] = nearbyScore[0]+"_"+sugg+"_"+nearbyScore[2]+"_"+userId;
    update[`suggestedFriends/${userId}/${friendId}/mutualScore`] = mutualScore[0]+"_"+sugg+"_"+mutualScore[2]+"_"+friendId;
    update[`suggestedFriends/${userId}/${friendId}/nearbyScore`] = nearbyScore[0]+"_"+sugg+"_"+nearbyScore[2]+"_"+friendId;
    await admin.database().ref('/').update(update);
    return true;
}















// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.beegoapi = functions.https.onRequest(app);
exports.onCreateUser = functions.database.ref('/users/{id}').onCreate(datasnapshot=>{
    const userKey = datasnapshot.key;
    const user = datasnapshot.val();
    const update = {}
    return admin.database().ref('users').once("value", snapshot=>{
        const friends = snapshot.val();
        for (const friendKey in friends){
            if(friendKey!==userKey){
                const distance = getDistance(friends[friendKey].lat,friends[friendKey].lat,user.lat,user.lon);
                update[`${friendKey}/${userKey}/mutualScore`]=9+"_0_999999"+"_"+userKey;
                update[`${userKey}/${friendKey}/mutualScore`]=9+"_0_999999"+"_"+friendKey;
                update[`${friendKey}/${userKey}/lat`] = user.lat;
                update[`${friendKey}/${userKey}/lon`] = user.lon;
                update[`${userKey}/${friendKey}/lat`] = friends[friendKey].lat;
                update[`${userKey}/${friendKey}/lon`] = friends[friendKey].lon;
                update[`${friendKey}/${userKey}/nearbyScore`]=9+"_0_"+distance+"_"+userKey;
                update[`${userKey}/${friendKey}/nearbyScore`]=9+"_0_"+distance+"_"+friendKey;
            }
        }
    }).then(()=>admin.database().ref('suggestedFriends').update(update));
});
exports.onUpdateUserLocation = functions.database.ref('users/{id}/location').onUpdate(user=>{
    const userKey = user.after.ref.parent.key;
    const location = user.after.val().split("_");
    const lat = parseFloat(location[0]);
    const lon = parseFloat(location[1]);
    const update = {};
    return admin.database().ref('suggestedFriends').child(userKey).once("value")
    .then(snapshot=>{
        const friends = snapshot.val();
        for (const friendKey in friends) {
            if(friendKey!==userKey){
                const friend = friends[friendKey];
                const nearbyScore = friend.nearbyScore.split("_");
                const distance = getDistance(lat,lon,friend.lat,friend.lon);
                update[`${userKey}/${friendKey}/nearbyScore`] = nearbyScore[0]+"_"+nearbyScore[1]+"_"+distance+"_"+friendKey;
                update[`${friendKey}/${userKey}/nearbyScore`] = nearbyScore[0]+"_"+nearbyScore[1]+"_"+distance+"_"+userKey;
                update[`${friendKey}/${userKey}/lat`] = lat;
                update[`${friendKey}/${userKey}/lon`] = lon;
            }
        }
        return admin.database().ref('suggestedFriends').update(update);
    });    
});
exports.onDeleteUser = functions.database.ref('/users/{id}').onDelete(user=>{
    const update = {};
    return admin.database().ref('suggestedFriends').once("value", snapshot=>{
        const users = snapshot.val();
        for (const key in users) {
            if(key!==user.key){
                update[`${key}/${user.key}`]=null;
            }
        }
        update[`${user.key}`]=null;
    }).then(()=>admin.database().ref('suggestedFriends').update(update))
});


function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}
function formatDistance(distance:number, length=8) {
    const distS = ""+distance;
    let i = 0;
    let formaDist = ""
    while (true) {
        if(i<distS.length){
            formaDist+= distS.charAt(i);
        }else{
            formaDist+="0";
        }
        i++;
        if(i>=length){
            return formaDist;
        }
    }
}
function getDistance(lat1, lon1, lat2, lon2) :string{
    if(lat1==0||lon1==0||lat2==0||lon2==0){
        return "999999.9";
    }
    const earthRadiusKm = 6371;
    const dLat = degreesToRadians(lat2-lat1);
    const dLon = degreesToRadians(lon2-lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * 
            Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const dist =  earthRadiusKm * c;
    return formatDistance(dist);
}
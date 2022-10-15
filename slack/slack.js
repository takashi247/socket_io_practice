const express = require("express");
const app = express();
const socketio = require("socket.io");
let namespaces = require("./data/namespaces");

app.use(express.static(__dirname + "/public"));

const expressServer = app.listen(9000);
const io = socketio(expressServer);

io.on("connection", (socket) => {
  // console.log(socket.handshake);
  // build an array to send back with the img and endpoint for each Namespace
  let nsData = namespaces.map((ns) => {
    return {
      img: ns.img,
      endpoint: ns.endpoint,
    };
  });
  // console.log(nsData);
  socket.emit("nsList", nsData);
});

// loop through each namespace and listen for a connection
namespaces.forEach((namespace) => {
  // console.log(namespace);
  io.of(namespace.endpoint).on("connect", (nsSocket) => {
    const username = nsSocket.handshake.query.username;
    console.log(`${nsSocket.id} has joined ${namespace.endpoint}`);

    nsSocket.emit("nsRoomLoad", namespace.rooms);

    nsSocket.on("joinRoom", (roomToJoin, numberOfUsersCallback) => {
      const roomToLeave = Array.from(nsSocket.rooms)[1];
      nsSocket.leave(roomToLeave);
      updateUsersInRoom(namespace, roomToLeave);
      nsSocket.join(roomToJoin);

      // io.of(namespace.endpoint)
      //   .in(roomToJoin)
      //   .allSockets()
      //   .then((users) => {
      //     numberOfUsersCallback(users.size);
      //   });

      // Another solution
      // const users = await io.of(namespace.endpoint).in(roomToJoin).allSockets();
      // const numberOfUsers = users.size;
      // numberOfUsersCallback(numberOfUsers);

      const nsRoom = namespace.rooms.find((room) => {
        return room.roomTitle === roomToJoin;
      });
      nsSocket.emit("historyCatchUp", nsRoom.history);
      updateUsersInRoom(namespace, roomToJoin);
    });

    nsSocket.on("newMessageToServer", (msg) => {
      const fullMsg = {
        text: msg.text,
        time: Date.now(),
        username: username,
        avatar: "https://via.placeholder.com/30",
      };
      // the user will be in the 2nd room in tehr object list
      // this is because the socket always joins its own room on connection
      // get the keys
      const roomTitle = Array.from(nsSocket.rooms)[1];
      // we need to find the Room object for this room
      const nsRoom = namespace.rooms.find((room) => {
        return room.roomTitle === roomTitle;
      });
      nsRoom.addMessage(fullMsg);
      console.log(nsRoom);
      io.of(namespace.endpoint).to(roomTitle).emit("messageToClients", fullMsg);
    });
  });
});

function updateUsersInRoom(namespace, roomToJoin) {
  // Send back the number of users in this room to all the other users
  io.of(namespace.endpoint)
    .in(roomToJoin)
    .allSockets()
    .then((users) => {
      io.of(namespace.endpoint)
        .in(roomToJoin)
        .emit("updateMembers", users.size);
    });
}

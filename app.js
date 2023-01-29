const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const databasePath = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());

let database = null;
const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3007, () =>
      console.log("Server Running at http://localhost:3007/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//#region Used Functions

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.user_id = payload.user_id;
        next();
      }
    });
  }
};

//#endregion

//#region API 1 /register/
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  let postQuery = "",
    CheckQuery = "",
    ErrorResult = "";

  CheckQuery = `
  SELECT username FROM user 
  WHERE username ='${username}'`;

  const check_response = await database.get(CheckQuery);

  let length = password.length;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);

  if (check_response === undefined) {
    if (length >= 6) {
      postTodoQuery = `
            INSERT INTO user (username, password, name, gender)
            VALUES  ('${username}', '${hashedPassword}', '${name}','${gender}');`;
      const db_response = await database.run(postTodoQuery);
      response.status(200).send("User created successfully");
    } else {
      response.status(400).send("Password is too short");
    }
  } else {
    response.status(400).send("User already exists");
  }
});
//#endregion

//#region API 2 /login/
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  let postQuery = "",
    CheckQuery = "",
    ErrorResult = "";

  CheckQuery = `
  SELECT username,password,user_id FROM user 
  WHERE username ='${username}'`;

  const check_response = await database.get(CheckQuery);

  console.log(check_response);

  if (check_response != undefined) {
    let user_id = check_response.user_id;
    const isPasswordMatched = await bcrypt.compare(
      password,
      check_response.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        user_id: user_id,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  } else {
    response.status(400).send("Invalid user");
  }
});
//#endregion

//#region API 3 /user/tweets/feed/
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let data = null;
  let getTweetQuery = "";
  let { user_id } = request;

  getTweetQuery = `
      SELECT 
      B.username	as username,
      A.tweet as tweet, 
      A.date_time as dateTime
      FROM tweet A
      INNER JOIN user B ON A.user_id=B.user_id 
      WHERE A.user_id = '${user_id}'
      ORDER BY date_time ASC  
      LIMIT 4 ;
      `;
  data = await database.all(getTweetQuery);
  response.send(data);
});
//#endregion

//#region API 4 /user/following/
app.get("/user/following/", authenticateToken, async (request, response) => {
  let data = null;
  let getTweetQuery = "";
  let { user_id } = request;

  getTweetQuery = `
      SELECT name
      FROM 
      follower A 
      INNER JOIN user B ON A.following_user_id=B.user_id 
      WHERE A.follower_user_id = '${user_id}'  `;
  data = await database.all(getTweetQuery);
  response.send(data);
});
//#endregion

//#region API 5 /user/followers/
app.get("/user/followers/", authenticateToken, async (request, response) => {
  let data = null;
  let getTweetQuery = "";
  let { user_id } = request;

  getTweetQuery = `
      SELECT name
      FROM 
      follower A 
      INNER JOIN user B ON A.follower_user_id=B.user_id 
      WHERE A.following_user_id = '${user_id}'  `;
  data = await database.all(getTweetQuery);
  response.send(data);
});
//#endregion

//#region API 6 /tweets/:tweetId/
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  let data = null;
  let userData = null;
  let getUserCheckQuery = "";
  let getTweetQuery = "";
  let { user_id } = request;
  let { tweetId } = request.params;

  getUserCheckQuery = `SELECT *
      FROM 
      tweet A
  WHERE A.tweet_id = '${tweetId}' AND A.user_id = '${user_id}'`;
  userData = await database.get(getUserCheckQuery);

  if (userData != undefined) {
    getTweetQuery = `
      SELECT A.tweet,
      (SELECT COUNT(like_id) FROM like C WHERE C.tweet_id=A.tweet_id) AS likes,
      (SELECT COUNT(reply_id) FROM reply B WHERE B.tweet_id=A.tweet_id) AS replies, 
      A.date_time AS dateTime
      FROM 
      tweet A  
      WHERE A.tweet_id = '${tweetId}'  `;
    data = await database.get(getTweetQuery);
    response.send(data);
  } else {
    response.status(401).send("Invalid Request");
  }
});
//#endregion

//#region API 7 /tweets/:tweetId/likes/
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    let data = null;
    let userData = null;
    let getUserCheckQuery = "";
    let getTweetQuery = "";
    let { user_id } = request;
    let { tweetId } = request.params;

    getUserCheckQuery = `SELECT *
      FROM 
      like A
      WHERE A.tweet_id = '${tweetId}' 
      AND A.user_id 
      IN (SELECT following_user_id FROM follower WHERE follower_user_id='${user_id}')`;
    userData = await database.get(getUserCheckQuery);

    if (userData != undefined) {
      getTweetQuery = `
      SELECT (SELECT name FROM user WHERE user_id=A.user_id) as likes
      FROM 
      like A  
      WHERE A.tweet_id = '${tweetId}'  `;
      data = await database.all(getTweetQuery);
      response.send(data);
    } else {
      response.status(401).send("Invalid Request");
    }
  }
);
//#endregion

//#region API 7 /tweets/:tweetId/replies/
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    let replies = null;
    let userData = null;
    let getUserCheckQuery = "";
    let getTweetQuery = "";
    let { user_id } = request;
    let { tweetId } = request.params;

    getUserCheckQuery = `SELECT *
      FROM 
      reply A
      WHERE A.tweet_id = '${tweetId}' 
      AND A.user_id 
      IN (SELECT following_user_id FROM follower WHERE follower_user_id='${user_id}')`;
    userData = await database.get(getUserCheckQuery);

    if (userData != undefined) {
      getTweetQuery = `
      SELECT (SELECT name FROM user WHERE user_id=A.user_id) as name,
              A.reply
      FROM 
      reply A  
      WHERE A.tweet_id = '${tweetId}'  `;
      replies = await database.all(getTweetQuery);

      response.send({ replies });
    } else {
      response.status(401).send("Invalid Request");
    }
  }
);
//#endregion

//#region API 9 Get - /user/tweets/
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let data = null;
  let getTweetQuery = "";
  let { user_id } = request;

  getTweetQuery = `
     SELECT A.tweet,
      (SELECT COUNT(like_id) FROM like C WHERE C.tweet_id=A.tweet_id) AS likes,
      (SELECT COUNT(reply_id) FROM reply B WHERE B.tweet_id=A.tweet_id) AS replies, 
      A.date_time AS dateTime
      FROM 
      tweet A  
      WHERE A.user_id = '${user_id}'  
      `;
  data = await database.all(getTweetQuery);
  response.send(data);
});
//#endregion

//#region API 10 Post- /user/tweets/
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let data = null;
  let getTweetQuery = "";
  let { user_id } = request;
  const { tweet } = request.body;

  console.log(tweet, user_id);

  getTweetQuery = `
  INSERT INTO tweet (tweet,user_id)
  VALUES('${tweet}','${user_id}')      `;
  data = await database.run(getTweetQuery);
  response.send("Created a Tweet");
});
//#endregion

//#region API 11 /tweets/:tweetId/
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    let data = null;
    let getTweetQuery = "";
    let getUserCheckQuery = "";
    let { user_id } = request;
    const { tweetId } = request.params;

    getUserCheckQuery = `SELECT *
      FROM 
      tweet A
  WHERE A.tweet_id = '${tweetId}' AND A.user_id = '${user_id}'`;
    userData = await database.get(getUserCheckQuery);

    if (userData != undefined) {
      getTweetQuery = `
      DELETE 
      FROM 
      tweet  
      WHERE tweet_id = '${tweetId}'  `;
      data = await database.all(getTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401).send("Invalid Request");
    }
  }
);
//#endregion

module.exports = app;

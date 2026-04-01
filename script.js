let socket;
let timerId;
let timer = 0;
let gameState;
let punchAmount = 0;
let amountSelected = 0;
let multipleCard = '';
let serverNick;

document.getElementsByClassName("nick")[0].value = localStorage.getItem("nickname");
document.getElementsByClassName("ipAddress")[0].value = localStorage.getItem("ipAddress");

if (localStorage.getItem("secret") == null) {
    localStorage.setItem("secret", crypto.randomUUID());
}

document.querySelector('.Connect').addEventListener('click', Open);

function OpenOld() {
    localStorage.setItem("nickname", document.getElementsByClassName("nick")[0].value);
    localStorage.setItem("ipAddress", document.getElementsByClassName("ipAddress")[0].value);

    socket = new WebSocket(`ws://${document.getElementsByClassName("ipAddress")[0].value}/Cards`);

    socket.onopen = function (e) {
        Message("Соединение установлено");
        Sleep(100);
        let nick = document.getElementsByClassName("nick")[0].value;

        socket.send(`{"Nickname":"${nick}","GameCode":"${document.getElementsByClassName("gameCode")[0].value}","MessageType":"Register"}`);

        //todo overlay
        document.getElementsByClassName("nick")[0].disabled = true;
    };

    socket.onclose = function (event) {
        Message("Соединение прервано");
    };

    socket.onmessage = function (event) {
        let json = JSON.parse(event.data);


        if (json.MessageType == "PlayerInfo") {
            document.getElementsByClassName("CardsInHand")[0].innerHTML = "";

            Object.entries(json.PlayerInfo.CardsInHand).map(
                (el) => {
                    let card = el[1];

                    let div = document.createElement("div");
                    div.className = `white`;


                    div.innerHTML = card.CardText;
                    div.setAttribute("onClick", `SendPlayedCard([\"${el[0]}\"])`);
                    div.className = `white`;

                    let setName = document.createElement("div");
                    setName.className = "setName";
                    setName.innerHTML = card.SetName;
                    div.appendChild(setName);

                    document.getElementsByClassName("CardsInHand")[0].appendChild(div);
                });
            serverNick = json.PlayerInfo.Nick;
        }


        if (json.MessageType == "GameState") {
            let isVoter = json.GameState.ScoreTable
                ?.find(st => st.Nick == serverNick)
                ?.IsVoter;
            if (isVoter) {
                document.getElementsByClassName("overlay2")[0].style.display = "";
            }
            else {
                document.getElementsByClassName("overlay2")[0].style.display = "none";
            }

            if (json.GameState.GameStateEnum == "Pick" && gameState != "Pick") {
                let audio = new Audio('ping.wav');
                audio.volume = 0.5;
                audio.play();
            }

            gameState = json.GameState.GameStateEnum;
            if (json.GameState.GameStateEnum != "NotStarted") {
                document.getElementsByClassName("overlay")[0].style.display = "none";
            }

            timer = json.GameState.SecondsToNextStage;
            timer -= 2; //HACK (ping (?))

            clearInterval(timerId);
            document.getElementsByClassName("MainTitle")[0].textContent = `${json.GameState.GameStateEnum}: Осталось времени ${timer} с.`;
            timerId = setInterval(function () {
                document.getElementsByClassName("MainTitle")[0].textContent = `${json.GameState.GameStateEnum}: Осталось времени ${timer} с.`;
                timer = Math.max(0, timer - 1);
            }, 1000);

            //setup cards on table
            document.getElementsByClassName("CardsOnTable")[0].innerHTML = ""; //clear

            Object.entries(json.GameState.PlayersCardsOnTableJson).forEach(function (el) {
                let div = document.createElement("div");
                let cardOffset = 0;
                Object.entries(el[1]).forEach(function (el) {
                    let div2 = document.createElement("div");
                    div2.className = `white`;
                    div2.style.transform = `translateY(${-90 * cardOffset}px)`;
                    div2.innerHTML = el[1].CardText;
                    div2.setAttribute("onClick", `SendRatedCard([\"${el[1].Id}\"])`);

                    div.appendChild(div2);
                    cardOffset++;
                });
                document.getElementsByClassName("CardsOnTable")[0].appendChild(div);
            });

            //setup joke
            if (json.GameState.JokeCard) {
                let aos = json.GameState.JokeCard.AmountOfSpaces
                aos = Math.max(Math.min(aos, 3), 1);
                punchAmount = aos;

                let punchCircleNumber = "";
                switch (punchAmount) {
                    case 1:
                        punchCircleNumber = "(1) ";
                        break;
                    case 2:
                        punchCircleNumber = "(2) ";
                        break;
                    case 3:
                        punchCircleNumber = "(3) ";
                        break;
                    default:
                        break;
                }

                let jokeTextEdited = "";

                if (json.GameState.WonCardsGuid) {
                    let correctPile = Array.from(document.getElementsByClassName("CardsOnTable")[0].childNodes).find((element) => element.innerHTML.includes(json.GameState.WonCardsGuid));
                    let correctPileArray = Array.from(correctPile.childNodes);

                    jokeTextEdited = json.GameState.JokeCard.CardText
                        .replaceAll("{0}", correctPileArray[0].innerHTML.replace(/\.$/, ""))
                        .replaceAll("{1}", correctPileArray[1] ? correctPileArray[1].innerHTML.replace(/\.$/, "") : "")
                        .replaceAll("{2}", correctPileArray[2] ? correctPileArray[2].innerHTML.replace(/\.$/, "") : "");
                }
                else {
                    jokeTextEdited = json.GameState.JokeCard.CardText.replaceAll("{0}", "_____").replaceAll("{1}", "_____").replaceAll("{2}", "_____");
                }

                document.getElementsByClassName("jokeTitle")[0].innerHTML = punchCircleNumber + jokeTextEdited;
                document.getElementsByClassName("black")[0].innerHTML =
                    json.GameState.JokeCard.CardText
                        .replaceAll("{0}", "_____")
                        .replaceAll("{1}", "_____")
                        .replaceAll("{2}", "_____");;
            }

            //fill score table
            document.getElementsByClassName("scoreTable")[0].innerHTML = json.GameState.ScoreTable
                .sort(function (a, b) {
                    if (a.OrderConnected > b.OrderConnected) {
                        return 1;
                    }
                    if (a.OrderConnected < b.OrderConnected) {
                        return -1;
                    }
                    return 0;
                })
                .reduce(function (currentSum, record) {
                    let boldNick = record.IsVoter
                        ? `<b>${record.Nick}</b>`
                        : record.Nick;

                    return currentSum + boldNick + ": " + record.VictoryPoints + "<br>";
                }, "");
        }
    };

}

async function Open() {
    localStorage.setItem("nickname", document.getElementsByClassName("nick")[0].value);
    localStorage.setItem("ipAddress", document.getElementsByClassName("ipAddress")[0].value);

    let response = await fetch(`http://${document.getElementsByClassName("ipAddress")[0].value}/GetJWT?nickname=${document.getElementsByClassName("nick")[0].value}&secret=${localStorage.getItem("secret")}`);
    var cert = response.text();

    let connection = await new signalR.HubConnectionBuilder()
        .withUrl(`http://${document.getElementsByClassName("ipAddress")[0].value}/Cards`, { accessTokenFactory: () => cert })
        //.withAutomaticReconnect()
        //.configureLogging(signalR.LogLevel.Information)
        .build();

    try {
        await connection.start();
        console.log("SignalR connected 😎");
    }
    catch (err) {
        console.error(err);
    }

    let nick = document.getElementsByClassName("nick")[0].value;
    try {
        connection.invoke("Test", { "Nickname": `${nick}`, "MessageType": "Register" });
    }
    catch (err) {
        console.error(err.toString());
    }






    //socket.onopen = function (e) {
    //    Message("Соединение установлено");
    //    Sleep(100);
    //    let nick = document.getElementsByClassName("nick")[0].value;

    //    socket.send(`{"Nickname":"${nick}","GameCode":"${document.getElementsByClassName("gameCode")[0].value}","MessageType":"Register"}`);

    //    //todo overlay
    //    document.getElementsByClassName("nick")[0].disabled = true;
    //};

    //socket.onclose = function (event) {
    //    Message("Соединение прервано");
    //};

    //socket.onmessage = function (event) {
    //    let json = JSON.parse(event.data);


    //    if (json.MessageType == "PlayerInfo") {
    //        document.getElementsByClassName("CardsInHand")[0].innerHTML = "";

    //        Object.entries(json.PlayerInfo.CardsInHand).map(
    //            (el) => {
    //                let card = el[1];

    //                let div = document.createElement("div");
    //                div.className = `white`;


    //                div.innerHTML = card.CardText;
    //                div.setAttribute("onClick", `SendPlayedCard([\"${el[0]}\"])`);
    //                div.className = `white`;

    //                let setName = document.createElement("div");
    //                setName.className = "setName";
    //                setName.innerHTML = card.SetName;
    //                div.appendChild(setName);

    //                document.getElementsByClassName("CardsInHand")[0].appendChild(div);
    //            });
    //        serverNick = json.PlayerInfo.Nick;
    //    }


    //    if (json.MessageType == "GameState") {
    //        let isVoter = json.GameState.ScoreTable
    //            ?.find(st => st.Nick == serverNick)
    //            ?.IsVoter;
    //        if (isVoter) {
    //            document.getElementsByClassName("overlay2")[0].style.display = "";
    //        }
    //        else {
    //            document.getElementsByClassName("overlay2")[0].style.display = "none";
    //        }

    //        if (json.GameState.GameStateEnum == "Pick" && gameState != "Pick") {
    //            let audio = new Audio('ping.wav');
    //            audio.volume = 0.5;
    //            audio.play();
    //        }

    //        gameState = json.GameState.GameStateEnum;
    //        if (json.GameState.GameStateEnum != "NotStarted") {
    //            document.getElementsByClassName("overlay")[0].style.display = "none";
    //        }

    //        timer = json.GameState.SecondsToNextStage;
    //        timer -= 2; //HACK (ping (?))

    //        clearInterval(timerId);
    //        document.getElementsByClassName("MainTitle")[0].textContent = `${json.GameState.GameStateEnum}: Осталось времени ${timer} с.`;
    //        timerId = setInterval(function () {
    //            document.getElementsByClassName("MainTitle")[0].textContent = `${json.GameState.GameStateEnum}: Осталось времени ${timer} с.`;
    //            timer = Math.max(0, timer - 1);
    //        }, 1000);

    //        //setup cards on table
    //        document.getElementsByClassName("CardsOnTable")[0].innerHTML = ""; //clear

    //        Object.entries(json.GameState.PlayersCardsOnTableJson).forEach(function (el) {
    //            let div = document.createElement("div");
    //            let cardOffset = 0;
    //            Object.entries(el[1]).forEach(function (el) {
    //                let div2 = document.createElement("div");
    //                div2.className = `white`;
    //                div2.style.transform = `translateY(${-90 * cardOffset}px)`;
    //                div2.innerHTML = el[1].CardText;
    //                div2.setAttribute("onClick", `SendRatedCard([\"${el[1].Id}\"])`);

    //                div.appendChild(div2);
    //                cardOffset++;
    //            });
    //            document.getElementsByClassName("CardsOnTable")[0].appendChild(div);
    //        });

    //        //setup joke
    //        if (json.GameState.JokeCard) {
    //            let aos = json.GameState.JokeCard.AmountOfSpaces
    //            aos = Math.max(Math.min(aos, 3), 1);
    //            punchAmount = aos;

    //            let punchCircleNumber = "";
    //            switch (punchAmount) {
    //                case 1:
    //                    punchCircleNumber = "(1) ";
    //                    break;
    //                case 2:
    //                    punchCircleNumber = "(2) ";
    //                    break;
    //                case 3:
    //                    punchCircleNumber = "(3) ";
    //                    break;
    //                default:
    //                    break;
    //            }

    //            let jokeTextEdited = "";

    //            if (json.GameState.WonCardsGuid) {
    //                let correctPile = Array.from(document.getElementsByClassName("CardsOnTable")[0].childNodes).find((element) => element.innerHTML.includes(json.GameState.WonCardsGuid));
    //                let correctPileArray = Array.from(correctPile.childNodes);

    //                jokeTextEdited = json.GameState.JokeCard.CardText
    //                    .replaceAll("{0}", correctPileArray[0].innerHTML.replace(/\.$/, ""))
    //                    .replaceAll("{1}", correctPileArray[1] ? correctPileArray[1].innerHTML.replace(/\.$/, "") : "")
    //                    .replaceAll("{2}", correctPileArray[2] ? correctPileArray[2].innerHTML.replace(/\.$/, "") : "");
    //            }
    //            else {
    //                jokeTextEdited = json.GameState.JokeCard.CardText.replaceAll("{0}", "_____").replaceAll("{1}", "_____").replaceAll("{2}", "_____");
    //            }

    //            document.getElementsByClassName("jokeTitle")[0].innerHTML = punchCircleNumber + jokeTextEdited;
    //            document.getElementsByClassName("black")[0].innerHTML =
    //                json.GameState.JokeCard.CardText
    //                    .replaceAll("{0}", "_____")
    //                    .replaceAll("{1}", "_____")
    //                    .replaceAll("{2}", "_____");;
    //        }

    //        //fill score table
    //        document.getElementsByClassName("scoreTable")[0].innerHTML = json.GameState.ScoreTable
    //            .sort(function (a, b) {
    //                if (a.OrderConnected > b.OrderConnected) {
    //                    return 1;
    //                }
    //                if (a.OrderConnected < b.OrderConnected) {
    //                    return -1;
    //                }
    //                return 0;
    //            })
    //            .reduce(function (currentSum, record) {
    //                let boldNick = record.IsVoter
    //                    ? `<b>${record.Nick}</b>`
    //                    : record.Nick;

    //                return currentSum + boldNick + ": " + record.VictoryPoints + "<br>";
    //            }, "");
    //    }
    //};
}

//function Send(input) {
//    socket.send(`{"Information":"${input}","MessageType":"Information"}`);
//}

function SendStart() {
    socket.send(`{"MessageType":"RoundStart"}`);
}

function SendPlayedCard(guid) {
    if (punchAmount == 1) {
        amountSelected = 0;
        socket.send(`{"PlayedPunchlines":[\"${guid}\"],"MessageType":"CardPlayed"}`);
    }
    else if (gameState == "Pick") {
        amountSelected++;
        multipleCard += `"${guid}",`;
        if (amountSelected == punchAmount) {
            socket.send(`{"PlayedPunchlines":[${multipleCard.slice(0, -1)}],"MessageType":"CardPlayed"}`);
            amountSelected = 0;
            multipleCard = "";
        }
    }
}

function SendRatedCard(guid) {
    let textRate = `{"PileGuid":\"${guid}\","MessageType":"CardRated"}`;
    socket.send(textRate);
}

function Message(text) {
    vt.info(text, {
        position: "bottom-right",
        duration: 3000
    });
}

function Sleep(milliseconds) {
    const date = Date.now();
    let currentDate = null;
    do {
        currentDate = Date.now();
    } while (currentDate - date < milliseconds);
}
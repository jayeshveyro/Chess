const board = document.getElementById("board");
const status = document.getElementById("status");
const moveHistory = document.getElementById("move-history");
const restartButton = document.getElementById("restart");

const promotionModal = document.getElementById("promotion-modal");
const promotionOptions = document.getElementById("promotion-options");

const pieces = {
    white: {
        king: "♔",
        queen: "♕",
        rook: "♖",
        bishop: "♗",
        knight: "♘",
        pawn: "♙"
    },
    black: {
        king: "♚",
        queen: "♛",
        rook: "♜",
        bishop: "♝",
        knight: "♞",
        pawn: "♟"
    }
};

const initialBoard = [
    ["black-rook", "black-knight", "black-bishop", "black-queen",
     "black-king", "black-bishop", "black-knight", "black-rook"],

    ["black-pawn", "black-pawn", "black-pawn", "black-pawn",
     "black-pawn", "black-pawn", "black-pawn", "black-pawn"],

    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],

    ["white-pawn", "white-pawn", "white-pawn", "white-pawn",
     "white-pawn", "white-pawn", "white-pawn", "white-pawn"],

    ["white-rook", "white-knight", "white-bishop", "white-queen",
     "white-king", "white-bishop", "white-knight", "white-rook"]
];

let boardState;
let currentTurn;
let selected;
let legalMoves;
let gameOver;
let moveList;
let enPassantTarget;

let castlingRights;

function resetGame() {

    boardState = copyBoard(initialBoard);

    currentTurn = "white";

    selected = null;
    legalMoves = [];

    gameOver = false;

    moveList = [];

    enPassantTarget = null;

    castlingRights = {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true
    };

    status.className = "status";

    moveHistory.innerHTML = "";

    createBoard();
    updateStatus();
}

restartButton.addEventListener("click", resetGame);

let audioContext = null;

function getAudioContext() {

    if (!audioContext) {
        audioContext =
            new (window.AudioContext ||
                 window.webkitAudioContext)();
    }

    return audioContext;
}

function playTone(
    frequency,
    duration,
    type = "sine",
    volume = 0.07
) {

    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(
        volume,
        ctx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();

    oscillator.stop(
        ctx.currentTime + duration
    );
}

function playMoveSound() {

    playTone(520, 0.08);

    setTimeout(() => {
        playTone(700, 0.07, "sine", 0.04);
    }, 50);
}

function playCaptureSound() {

    playTone(220, 0.09, "square");

    setTimeout(() => {
        playTone(130, 0.12, "square", 0.05);
    }, 70);
}

function playCheckSound() {

    playTone(700, 0.12, "triangle");

    setTimeout(() => {
        playTone(900, 0.15, "triangle");
    }, 100);
}

function playCheckmateSound() {

    playTone(500, 0.15, "triangle");

    setTimeout(() => {
        playTone(400, 0.15, "triangle");
    }, 150);

    setTimeout(() => {
        playTone(250, 0.3, "triangle");
    }, 300);
}


function createBoard() {

    board.innerHTML = "";

    for (let row = 0; row < 8; row++) {

        for (let col = 0; col < 8; col++) {

            const square = document.createElement("div");

            square.classList.add("square");

            if ((row + col) % 2 === 0) {
                square.classList.add("light");
            } else {
                square.classList.add("dark");
            }

            const piece = boardState[row][col];

            if (piece) {

                const element =
                    document.createElement("span");

                element.textContent =
                    getPieceSymbol(piece);

                element.classList.add(
                    getColor(piece) === "white"
                        ? "white-piece"
                        : "black-piece"
                );

                square.appendChild(element);
            }

            square.addEventListener(
                "click",
                () => handleSquareClick(row, col)
            );

            board.appendChild(square);
        }
    }

    highlightSelected();
    highlightMoves();
    highlightCheck();
}

function handleSquareClick(row, col) {

    if (gameOver) return;

    const clickedPiece = boardState[row][col];

    if (selected) {

        const isLegal = legalMoves.some(
            move =>
                move.row === row &&
                move.col === col
        );

        if (isLegal) {

            movePiece(
                selected.row,
                selected.col,
                row,
                col
            );

            return;
        }

        if (
            clickedPiece &&
            getColor(clickedPiece) === currentTurn
        ) {

            selectPiece(row, col);
            return;
        }

        selected = null;
        legalMoves = [];

        createBoard();
        updateStatus();

        return;
    }

    if (
        clickedPiece &&
        getColor(clickedPiece) === currentTurn
    ) {

        selectPiece(row, col);
    }
}

function selectPiece(row, col) {

    selected = {
        row,
        col
    };

    legalMoves = getLegalMoves(row, col);

    createBoard();

    status.textContent =
        `${capitalize(currentTurn)} selected`;
}

function movePiece(
    fromRow,
    fromCol,
    toRow,
    toCol
) {

    const piece =
        boardState[fromRow][fromCol];

    const capturedPiece =
        boardState[toRow][toCol];

    const movingColor =
        getColor(piece);

    const movingType =
        getType(piece);

    const wasEnPassant =
        movingType === "pawn" &&
        !capturedPiece &&
        fromCol !== toCol &&
        enPassantTarget &&
        enPassantTarget.row === toRow &&
        enPassantTarget.col === toCol;

    if (wasEnPassant) {

        const capturedPawnRow =
            movingColor === "white"
                ? toRow + 1
                : toRow - 1;

        boardState[capturedPawnRow][toCol] = null;
    }


    boardState[toRow][toCol] = piece;
    boardState[fromRow][fromCol] = null;

    if (
        movingType === "king" &&
        Math.abs(toCol - fromCol) === 2
    ) {

        const rookFromCol =
            toCol > fromCol ? 7 : 0;

        const rookToCol =
            toCol > fromCol ? 5 : 3;

        boardState[fromRow][rookToCol] =
            boardState[fromRow][rookFromCol];

        boardState[fromRow][rookFromCol] =
            null;
    }

    updateCastlingRights(
        piece,
        fromRow,
        fromCol,
        capturedPiece,
        toRow,
        toCol
    );

    enPassantTarget = null;

    if (
        movingType === "pawn" &&
        Math.abs(toRow - fromRow) === 2
    ) {

        enPassantTarget = {
            row: (fromRow + toRow) / 2,
            col: fromCol
        };
    }

    if (
        movingType === "pawn" &&
        (toRow === 0 || toRow === 7)
    ) {

        showPromotion(
            toRow,
            toCol,
            movingColor,
            piece,
            capturedPiece,
            wasEnPassant
        );

        return;
    }


    finishMove(
        piece,
        capturedPiece,
        wasEnPassant,
        fromRow,
        fromCol,
        toRow,
        toCol
    );
}

function finishMove(
    piece,
    capturedPiece,
    wasEnPassant,
    fromRow,
    fromCol,
    toRow,
    toCol
) {

    if (capturedPiece || wasEnPassant) {
        playCaptureSound();
    } else {
        playMoveSound();
    }


    addMoveToHistory(
        piece,
        fromRow,
        fromCol,
        toRow,
        toCol,
        capturedPiece || wasEnPassant
    );


    selected = null;
    legalMoves = [];


    currentTurn =
        oppositeColor(currentTurn);


    const inCheck =
        isKingInCheck(
            currentTurn,
            boardState
        );

    const availableMoves =
        getAllLegalMoves(currentTurn);


    createBoard();


    // CHECKMATE
    if (
        inCheck &&
        availableMoves.length === 0
    ) {

        gameOver = true;

        status.textContent =
            `CHECKMATE — ${capitalize(
                oppositeColor(currentTurn)
            )} wins!`;

        status.className =
            "status game-over";

        playCheckmateSound();

        return;
    }


    // STALEMATE
    if (
        !inCheck &&
        availableMoves.length === 0
    ) {

        gameOver = true;

        status.textContent =
            "STALEMATE — Draw";

        status.className =
            "status game-over";

        return;
    }


    // CHECK
    if (inCheck) {

        status.textContent =
            `${capitalize(currentTurn)} is in CHECK!`;

        status.className =
            "status check-status";

        playCheckSound();

    } else {

        updateStatus();
    }
}

function showPromotion(
    row,
    col,
    color,
    originalPiece,
    capturedPiece,
    wasEnPassant
) {

    promotionOptions.innerHTML = "";

    const choices = [
        "queen",
        "rook",
        "bishop",
        "knight"
    ];

    choices.forEach(type => {

        const button =
            document.createElement("button");

        button.className =
            "promotion-option";

        button.textContent =
            pieces[color][type];

        button.addEventListener(
            "click",
            () => {

                boardState[row][col] =
                    `${color}-${type}`;

                promotionModal.classList.add(
                    "hidden"
                );

                finishMove(
                    originalPiece,
                    capturedPiece,
                    wasEnPassant,
                    row === 0 ? row + 1 : row - 1,
                    col,
                    row,
                    col
                );
            }
        );

        promotionOptions.appendChild(button);
    });

    promotionModal.classList.remove("hidden");
}

function updateCastlingRights(
    piece,
    fromRow,
    fromCol,
    capturedPiece,
    toRow,
    toCol
) {

    const color = getColor(piece);
    const type = getType(piece);


    if (type === "king") {

        if (color === "white") {
            castlingRights.whiteKingSide = false;
            castlingRights.whiteQueenSide = false;
        } else {
            castlingRights.blackKingSide = false;
            castlingRights.blackQueenSide = false;
        }
    }


    if (type === "rook") {

        if (
            color === "white" &&
            fromRow === 7 &&
            fromCol === 0
        ) {
            castlingRights.whiteQueenSide = false;
        }

        if (
            color === "white" &&
            fromRow === 7 &&
            fromCol === 7
        ) {
            castlingRights.whiteKingSide = false;
        }

        if (
            color === "black" &&
            fromRow === 0 &&
            fromCol === 0
        ) {
            castlingRights.blackQueenSide = false;
        }

        if (
            color === "black" &&
            fromRow === 0 &&
            fromCol === 7
        ) {
            castlingRights.blackKingSide = false;
        }
    }


    // Rook captured
    if (
        capturedPiece &&
        getType(capturedPiece) === "rook"
    ) {

        if (toRow === 7 && toCol === 0) {
            castlingRights.whiteQueenSide = false;
        }

        if (toRow === 7 && toCol === 7) {
            castlingRights.whiteKingSide = false;
        }

        if (toRow === 0 && toCol === 0) {
            castlingRights.blackQueenSide = false;
        }

        if (toRow === 0 && toCol === 7) {
            castlingRights.blackKingSide = false;
        }
    }
}

function getLegalMoves(row, col) {

    const piece = boardState[row][col];

    if (!piece) return [];

    const color = getColor(piece);

    const pseudoMoves =
        getPseudoLegalMoves(
            row,
            col,
            boardState
        );

    const legal = [];

    for (const move of pseudoMoves) {

        const simulated =
            copyBoard(boardState);

        simulated[move.row][move.col] =
            simulated[row][col];

        simulated[row][col] = null;

        if (
            !isKingInCheck(
                color,
                simulated
            )
        ) {

            legal.push(move);
        }
    }

    return legal;
}

function getAllLegalMoves(color) {

    const moves = [];

    for (let row = 0; row < 8; row++) {

        for (let col = 0; col < 8; col++) {

            const piece =
                boardState[row][col];

            if (
                piece &&
                getColor(piece) === color
            ) {

                moves.push(
                    ...getLegalMoves(row, col)
                );
            }
        }
    }

    return moves;
}

function getPseudoLegalMoves(
    row,
    col,
    state
) {

    const piece = state[row][col];

    if (!piece) return [];

    const color = getColor(piece);
    const type = getType(piece);


    switch (type) {

        case "pawn":
            return getPawnMoves(
                row,
                col,
                color,
                state
            );

        case "rook":
            return getRookMoves(
                row,
                col,
                color,
                state
            );

        case "bishop":
            return getBishopMoves(
                row,
                col,
                color,
                state
            );

        case "queen":
            return [
                ...getRookMoves(
                    row,
                    col,
                    color,
                    state
                ),
                ...getBishopMoves(
                    row,
                    col,
                    color,
                    state
                )
            ];

        case "knight":
            return getKnightMoves(
                row,
                col,
                color,
                state
            );

        case "king":
            return getKingMoves(
                row,
                col,
                color,
                state
            );

        default:
            return [];
    }
}


function getPawnMoves(
    row,
    col,
    color,
    state
) {

    const moves = [];

    const direction =
        color === "white" ? -1 : 1;

    const startRow =
        color === "white" ? 6 : 1;


    const forward = row + direction;

    if (
        isInside(forward, col) &&
        !state[forward][col]
    ) {

        moves.push({
            row: forward,
            col
        });

        const double =
            row + direction * 2;

        if (
            row === startRow &&
            !state[double][col]
        ) {

            moves.push({
                row: double,
                col
            });
        }
    }


    for (const dc of [-1, 1]) {

        const r = row + direction;
        const c = col + dc;

        if (!isInside(r, c)) continue;

        const target = state[r][c];

        if (
            target &&
            getColor(target) !== color &&
            getType(target) !== "king"
        ) {

            moves.push({
                row: r,
                col: c
            });
        }


        // En passant
        if (
            enPassantTarget &&
            enPassantTarget.row === r &&
            enPassantTarget.col === c
        ) {

            moves.push({
                row: r,
                col: c
            });
        }
    }

    return moves;
}

function getRookMoves(
    row,
    col,
    color,
    state
) {

    return getSlidingMoves(
        row,
        col,
        color,
        state,
        [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1]
        ]
    );
}

function getBishopMoves(
    row,
    col,
    color,
    state
) {

    return getSlidingMoves(
        row,
        col,
        color,
        state,
        [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1]
        ]
    );
}

function getKnightMoves(
    row,
    col,
    color,
    state
) {

    const moves = [];

    const directions = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1]
    ];

    for (const [dr, dc] of directions) {

        const r = row + dr;
        const c = col + dc;

        if (!isInside(r, c)) continue;

        const target = state[r][c];

        if (
            !target ||
            (
                getColor(target) !== color &&
                getType(target) !== "king"
            )
        ) {

            moves.push({
                row: r,
                col: c
            });
        }
    }

    return moves;
}

function getKingMoves(
    row,
    col,
    color,
    state
) {

    const moves = [];

    for (let dr = -1; dr <= 1; dr++) {

        for (let dc = -1; dc <= 1; dc++) {

            if (dr === 0 && dc === 0) continue;

            const r = row + dr;
            const c = col + dc;

            if (!isInside(r, c)) continue;

            const target = state[r][c];

            if (
                !target ||
                (
                    getColor(target) !== color &&
                    getType(target) !== "king"
                )
            ) {

                moves.push({
                    row: r,
                    col: c
                });
            }
        }
    }


    if (canCastleKingSide(color, state)) {

        moves.push({
            row,
            col: col + 2
        });
    }


    if (canCastleQueenSide(color, state)) {

        moves.push({
            row,
            col: col - 2
        });
    }


    return moves;
}

function getSlidingMoves(
    row,
    col,
    color,
    state,
    directions
) {

    const moves = [];

    for (const [dr, dc] of directions) {

        let r = row + dr;
        let c = col + dc;

        while (isInside(r, c)) {

            const target = state[r][c];

            if (!target) {

                moves.push({
                    row: r,
                    col: c
                });

            } else {

                if (
                    getColor(target) !== color &&
                    getType(target) !== "king"
                ) {

                    moves.push({
                        row: r,
                        col: c
                    });
                }

                break;
            }

            r += dr;
            c += dc;
        }
    }

    return moves;
}

function canCastleKingSide(
    color,
    state
) {

    const row =
        color === "white" ? 7 : 0;

    const allowed =
        color === "white"
            ? castlingRights.whiteKingSide
            : castlingRights.blackKingSide;

    if (!allowed) return false;

    if (
        state[row][4] !==
        `${color}-king`
    ) return false;

    if (
        state[row][7] !==
        `${color}-rook`
    ) return false;

    if (
        state[row][5] ||
        state[row][6]
    ) return false;

    if (
        isKingInCheck(
            color,
            state
        )
    ) return false;


    const test =
        copyBoard(state);

    test[row][5] =
        test[row][4];

    test[row][4] = null;

    if (
        isKingInCheck(
            color,
            test
        )
    ) return false;


    return true;
}


function canCastleQueenSide(
    color,
    state
) {

    const row =
        color === "white" ? 7 : 0;

    const allowed =
        color === "white"
            ? castlingRights.whiteQueenSide
            : castlingRights.blackQueenSide;

    if (!allowed) return false;

    if (
        state[row][4] !==
        `${color}-king`
    ) return false;

    if (
        state[row][0] !==
        `${color}-rook`
    ) return false;

    if (
        state[row][1] ||
        state[row][2] ||
        state[row][3]
    ) return false;

    if (
        isKingInCheck(
            color,
            state
        )
    ) return false;


    const test =
        copyBoard(state);

    test[row][3] =
        test[row][4];

    test[row][4] = null;

    if (
        isKingInCheck(
            color,
            test
        )
    ) return false;


    return true;
}

function isKingInCheck(
    color,
    state
) {

    let kingRow = -1;
    let kingCol = -1;


    for (let row = 0; row < 8; row++) {

        for (let col = 0; col < 8; col++) {

            if (
                state[row][col] ===
                `${color}-king`
            ) {

                kingRow = row;
                kingCol = col;

                break;
            }
        }

        if (kingRow !== -1) break;
    }


    if (kingRow === -1) return true;


    const enemy =
        oppositeColor(color);


    for (let row = 0; row < 8; row++) {

        for (let col = 0; col < 8; col++) {

            const piece =
                state[row][col];

            if (
                !piece ||
                getColor(piece) !== enemy
            ) continue;


            const attacks =
                getAttackMoves(
                    row,
                    col,
                    state
                );


            if (
                attacks.some(
                    move =>
                        move.row === kingRow &&
                        move.col === kingCol
                )
            ) {

                return true;
            }
        }
    }


    return false;
}

function getAttackMoves(
    row,
    col,
    state
) {

    const piece = state[row][col];

    const color = getColor(piece);
    const type = getType(piece);


    if (type === "pawn") {

        const moves = [];

        const direction =
            color === "white" ? -1 : 1;

        for (const dc of [-1, 1]) {

            const r = row + direction;
            const c = col + dc;

            if (isInside(r, c)) {

                moves.push({
                    row: r,
                    col: c
                });
            }
        }

        return moves;
    }


    if (type === "king") {

        const moves = [];

        for (let dr = -1; dr <= 1; dr++) {

            for (let dc = -1; dc <= 1; dc++) {

                if (dr === 0 && dc === 0) continue;

                const r = row + dr;
                const c = col + dc;

                if (isInside(r, c)) {

                    moves.push({
                        row: r,
                        col: c
                    });
                }
            }
        }

        return moves;
    }


    return getPseudoLegalMoves(
        row,
        col,
        state
    );
}

function highlightSelected() {

    if (!selected) return;

    const index =
        selected.row * 8 +
        selected.col;

    board.children[index]
        ?.classList.add("selected");
}


function highlightMoves() {

    legalMoves.forEach(move => {

        const index =
            move.row * 8 +
            move.col;

        const square =
            board.children[index];

        if (!square) return;

        if (
            boardState[move.row][move.col]
        ) {

            square.classList.add(
                "possible-capture"
            );

        } else {

            square.classList.add(
                "possible-move"
            );
        }
    });
}


function highlightCheck() {

    if (
        !isKingInCheck(
            currentTurn,
            boardState
        )
    ) return;


    for (let row = 0; row < 8; row++) {

        for (let col = 0; col < 8; col++) {

            if (
                boardState[row][col] ===
                `${currentTurn}-king`
            ) {

                board.children[
                    row * 8 + col
                ].classList.add(
                    "in-check"
                );
            }
        }
    }
}

function addMoveToHistory(
    piece,
    fromRow,
    fromCol,
    toRow,
    toCol,
    captured
) {

    const symbols = {
        pawn: "♙",
        knight: "♘",
        bishop: "♗",
        rook: "♖",
        queen: "♕",
        king: "♔"
    };

    const type =
        getType(piece);

    const from =
        squareName(
            fromRow,
            fromCol
        );

    const to =
        squareName(
            toRow,
            toCol
        );

    const notation =
        `${symbols[type]} ${from} → ${to}` +
        (captured ? " ×" : "");

    moveList.push(notation);

    moveHistory.innerHTML = "";

    moveList.forEach(
        (move, index) => {

            const div =
                document.createElement("div");

            div.className = "move";

            div.textContent =
                `${index + 1}. ${move}`;

            moveHistory.appendChild(div);
        }
    );

    moveHistory.scrollTop =
        moveHistory.scrollHeight;
}

function getPieceSymbol(piece) {

    const [color, type] =
        piece.split("-");

    return pieces[color][type];
}


function getColor(piece) {

    return piece
        ? piece.split("-")[0]
        : null;
}


function getType(piece) {

    return piece
        ? piece.split("-")[1]
        : null;
}


function oppositeColor(color) {

    return color === "white"
        ? "black"
        : "white";
}


function copyBoard(state) {

    return state.map(
        row => [...row]
    );
}


function isInside(row, col) {

    return (
        row >= 0 &&
        row < 8 &&
        col >= 0 &&
        col < 8
    );
}


function squareName(row, col) {

    const files = "abcdefgh";

    return (
        files[col] +
        (8 - row)
    );
}


function capitalize(word) {

    return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
    );
}


function updateStatus() {

    status.className = "status";

    status.textContent =
        `${capitalize(currentTurn)}'s turn`;
}

resetGame();

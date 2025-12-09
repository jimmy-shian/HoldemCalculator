import React, { useState, useEffect, useRef } from 'react';
import { Card, GameStage, Player, GameState, HandRank, HandResult, GameMode } from './types';
import { INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND, PLAYER_COUNT, ANIMATION_DELAY, RECOVERY_PASSWORD, MAX_ALLIN } from './constants';
import { createDeck, evaluateHand } from './services/pokerEngine';
import { playSound } from './services/soundService';
import { joinTable, sendAction, sendRoundEnd } from './services/api';
import { PlayerSeat } from './components/PlayerSeat';
import { CardComponent } from './components/CardComponent';
import { GameControls } from './components/GameControls';
import { Trophy, Clock, Hash, RotateCcw } from 'lucide-react';

// --- Particle/Chip Animation Component ---
const CoinParticles = ({ start, target }: { start: { x: number, y: number }, target: { x: number, y: number } }) => {
    const particles = Array.from({ length: 20 });
    return (
        <div className="fixed inset-0 pointer-events-none z-[60]">
            {particles.map((_, i) => {
                const delay = i * 0.05;
                return (
                    <div
                        key={i}
                        className="absolute w-3 h-3 md:w-4 md:h-4 bg-yellow-400 rounded-full border border-yellow-600 shadow-md"
                        style={{
                            left: start.x,
                            top: start.y,
                            transition: `all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s`,
                            opacity: 1,
                        }}
                        ref={el => {
                            if (el) {
                                requestAnimationFrame(() => {
                                    el.style.left = `${target.x}px`;
                                    el.style.top = `${target.y}px`;
                                    el.style.opacity = '0';
                                });
                            }
                        }}
                    />
                );
            })}
        </div>
    );
};

const App: React.FC = () => {
  // --- State ---
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SINGLEPLAYER);
  const [isSpectating, setIsSpectating] = useState(true); // For Singleplayer tracking
  const [pendingPlayerName, setPendingPlayerName] = useState<{name: string, seat: number} | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    stage: GameStage.IDLE,
    pot: 0,
    communityCards: [],
    deckSeed: Date.now(),
    currentTurnIndex: -1,
    dealerIndex: 0,
    highestBet: 0,
    minRaise: BIG_BLIND,
    winners: [],
    roundNumber: 0,
  });

  // Initial Players - Always start with Bots
  const [players, setPlayers] = useState<Player[]>([
    { id: 0, name: 'Bot User', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: true, isActive: false },
    { id: 1, name: 'Bot Alpha', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: false, isActive: false },
    { id: 2, name: 'Bot Beta', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: false, isActive: false },
    { id: 3, name: 'Bot Gamma', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: false, isActive: false },
  ]);

  const [notification, setNotification] = useState<string>('');
  const [deck, setDeck] = useState<Card[]>([]);
  const [winningHandResult, setWinningHandResult] = useState<HandResult | null>(null);
  const [timeStr, setTimeStr] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showChipAnim, setShowChipAnim] = useState<{start: {x:number, y:number}, target: {x:number, y:number}} | null>(null);

  const turnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameLoopRef = useRef<boolean>(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    const timer = setInterval(() => {
        const now = new Date();
        setTimeStr(now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Initial start logic for both modes
    if (gameState.stage === GameStage.IDLE && !gameLoopRef.current) {
         setTimeout(startNewHand, 1000);
         gameLoopRef.current = true;
    }
  }, [gameMode]);

  // AI Turn Logic
  useEffect(() => {
    if (gameState.currentTurnIndex !== -1 && gameState.stage !== GameStage.SHOWDOWN && gameState.stage !== GameStage.IDLE) {
      const currentPlayer = players[gameState.currentTurnIndex];
      // Note: This relies on currentPlayer.isHuman. If hot-swap happens, this hook re-runs with new players array,
      // the condition (!isHuman) becomes false, timeout is cleared by cleanup, and Bot stops automatically.
      if (!currentPlayer.isHuman && !currentPlayer.hasFolded && currentPlayer.chips > 0) {
        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
        turnTimeoutRef.current = setTimeout(() => {
          botTurn(currentPlayer);
        }, ANIMATION_DELAY);
      }
    }
    return () => {
        if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    };
  }, [gameState.currentTurnIndex, gameState.stage, players]);

  // --- Logic ---

  const switchGameMode = (mode: GameMode) => {
      setGameMode(mode);
      setGameState(prev => ({ ...prev, stage: GameStage.IDLE, pot: 0, communityCards: [], winners: [], roundNumber: 0 }));
      setDeck([]);
      setWinningHandResult(null);
      gameLoopRef.current = false;
      
      // Reset to Bots for both modes
      setPlayers([
        { id: 0, name: 'Bot User', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: true, isActive: false },
        { id: 1, name: 'Bot Alpha', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: false, isActive: false },
        { id: 2, name: 'Bot Beta', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: false, isActive: false },
        { id: 3, name: 'Bot Gamma', isHuman: false, chips: INITIAL_CHIPS, bet: 0, totalHandBet: 0, cards: [], hasFolded: false, isDealer: false, isActive: false },
      ]);
      
      if (mode === GameMode.MULTIPLAYER) {
          setNotification("多人模式: 點擊機器人加入 (Multiplayer: Click bot to join)");
      } else {
          setIsSpectating(true);
          setPendingPlayerName(null);
      }
      
      // Restart game loop shortly
      setTimeout(startNewHand, 1000);
  };

  const handleJoinQueue = (seatIndex: number, name: string) => {
      // API call logging
      joinTable({ tableId: 'table-1', seatIndex, playerName: name });

      setPendingPlayerName({ name, seat: seatIndex });
      
      if (gameMode === GameMode.SINGLEPLAYER) {
        setNotification(`歡迎 ${name}! 請等待下一局開始...`);
        // Singleplayer logic waits for next hand in startNewHand
      } else {
        // Multiplayer Hot Swap: Join immediately
        setPlayers(prev => prev.map(p => {
             if (p.id === seatIndex) {
                 // Take over the bot
                 return { ...p, name: name, isHuman: true }; 
             }
             return p;
        }));
        setPendingPlayerName(null);
        setNotification(`${name} 加入遊戲 (Joined Game)`);
      }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (recoveryCode.toLowerCase() === RECOVERY_PASSWORD) {
          if (!isSpectating || gameMode === GameMode.MULTIPLAYER) {
            // Find human player with 0 chips
            const updated = players.map(p => (p.isHuman && p.chips === 0) ? { ...p, chips: INITIAL_CHIPS } : p);
            setPlayers(updated);
            setNotification("資金已恢復! (Chips Recovered)");
            playSound('chip');
            setRecoveryCode('');
          } else {
            setNotification("請先入座! (Please join first)");
          }
      } else {
          setNotification("密碼錯誤 (Invalid Code)");
      }
  };

  const resetRoundBets = () => {
    setPlayers(prev => prev.map(p => ({ ...p, bet: 0, actionText: undefined })));
    setGameState(prev => ({ ...prev, highestBet: 0 }));
  };

  const nextStage = () => {
    const activePlayersWithChips = players.filter(p => !p.hasFolded && p.chips > 0);
    // If fewer than 2 active players with chips (e.g. everyone is all-in), run out the board
    if (activePlayersWithChips.length < 2 && gameState.stage !== GameStage.SHOWDOWN && gameState.stage !== GameStage.IDLE) {
       runOutBoard();
       return;
    }

    const stageOrder = [GameStage.PREFLOP, GameStage.FLOP, GameStage.TURN, GameStage.RIVER, GameStage.SHOWDOWN];
    const currentIdx = stageOrder.indexOf(gameState.stage);
    
    resetRoundBets();

    if (currentIdx >= 3) {
      handleShowdown();
      return;
    }

    const nextGameStage = stageOrder[currentIdx + 1];
    let cardsToDeal = 0;
    
    if (nextGameStage === GameStage.FLOP) cardsToDeal = 3;
    else if (nextGameStage === GameStage.TURN) cardsToDeal = 1;
    else if (nextGameStage === GameStage.RIVER) cardsToDeal = 1;

    const deckCopy = [...deck];
    const dealt = deckCopy.splice(0, cardsToDeal);
    setDeck(deckCopy);
    
    playSound('card');
    
    setGameState(prev => ({
      ...prev,
      stage: nextGameStage,
      communityCards: [...prev.communityCards, ...dealt],
      currentTurnIndex: (prev.dealerIndex + 1) % PLAYER_COUNT,
      highestBet: 0
    }));

    setTimeout(() => {
        advanceTurn((gameState.dealerIndex + 1) % PLAYER_COUNT, true);
    }, 500);
  };

  const advanceTurn = (startIndex: number, newStage: boolean = false) => {
    let nextIndex = startIndex;
    if (!newStage) {
        nextIndex = (gameState.currentTurnIndex + 1) % PLAYER_COUNT;
    }

    let attempts = 0;
    // Skip: Folded, or No Chips (All-in)
    while ((players[nextIndex].hasFolded || players[nextIndex].chips === 0) && attempts < 5) {
       nextIndex = (nextIndex + 1) % PLAYER_COUNT;
       attempts++;
    }

    const notFolded = players.filter(p => !p.hasFolded && (p.chips > 0 || p.bet > 0)); // Active in hand
    if (notFolded.length < 2 && gameState.stage !== GameStage.SHOWDOWN) {
       handleShowdown(); 
       return;
    }

    const activeWithChips = notFolded.filter(p => p.chips > 0);
    if (activeWithChips.length === 0) {
        setTimeout(runOutBoard, 1000);
        return;
    }

    setGameState(prev => ({ ...prev, currentTurnIndex: nextIndex }));
  };

  const handleAction = (playerId: number, action: 'check' | 'call' | 'raise' | 'fold' | 'allin', amount: number = 0) => {
    // API Call Log
    sendAction({ tableId: 'table-1', playerId, action, amount });

    let updatedPlayers = [...players];
    const player = updatedPlayers[playerId];
    let newHighestBet = gameState.highestBet;

    if (action === 'fold') {
      player.hasFolded = true;
      player.actionText = '棄牌 (Fold)';
      playSound('fold');
    } else if (action === 'check') {
      player.actionText = '過牌 (Check)';
      playSound('check');
    } else if (action === 'call') {
      const callAmount = gameState.highestBet - player.bet;
      const amountToDeduced = Math.min(player.chips, callAmount);
      player.chips -= amountToDeduced;
      player.bet += amountToDeduced;
      player.totalHandBet += amountToDeduced;
      setGameState(prev => ({ ...prev, pot: prev.pot + amountToDeduced }));
      player.actionText = player.chips === 0 ? 'All In' : '跟注 (Call)';
      playSound('chip');
    } else if (action === 'raise' || action === 'allin') {
      let raiseTo = amount;
      if (raiseTo > MAX_ALLIN) raiseTo = MAX_ALLIN;
      if (raiseTo < gameState.highestBet && player.chips + player.bet > raiseTo) {
          raiseTo = gameState.highestBet; 
      }
      const amountToAdd = raiseTo - player.bet;
      const actualAdd = Math.min(player.chips, amountToAdd);
      
      player.chips -= actualAdd;
      player.bet += actualAdd;
      player.totalHandBet += actualAdd;
      setGameState(prev => ({ ...prev, pot: prev.pot + actualAdd }));
      
      newHighestBet = Math.max(newHighestBet, player.bet);
      player.actionText = player.chips === 0 ? 'All In' : `加注 (Raise) ${player.bet}`;
      playSound('chip');
    }

    setPlayers(updatedPlayers);
    setGameState(prev => ({ ...prev, highestBet: newHighestBet }));

    const notFolded = updatedPlayers.filter(p => !p.hasFolded && (p.chips > 0 || p.bet > 0));
    if (notFolded.length === 1) {
      setTimeout(() => declareWinner([notFolded[0].id]), 1000);
      return;
    }

    const activePlayersWithChips = notFolded.filter(p => p.chips > 0);
    const allMatched = notFolded.every(p => p.bet === newHighestBet || p.chips === 0);
    
    if (allMatched && activePlayersWithChips.length < 2) {
       runOutBoard();
       return;
    }

    const bbIndex = (gameState.dealerIndex + 2) % PLAYER_COUNT;
    // Special Preflop Rule: Big Blind gets option if unraised
    if (gameState.stage === GameStage.PREFLOP && playerId !== bbIndex && newHighestBet === BIG_BLIND) {
         advanceTurn(playerId);
    } else if (allMatched && action !== 'raise' && action !== 'allin') {
         setTimeout(nextStage, 800);
    } else {
        advanceTurn(playerId);
    }
  };

  const runOutBoard = async () => {
     let currentStage = gameState.stage;
     const deckCopy = [...deck];
     let community = [...gameState.communityCards];
     
     const deal = (count: number) => {
         const added = deckCopy.splice(0, count);
         community = [...community, ...added];
         setDeck(deckCopy);
         setGameState(prev => ({...prev, communityCards: community}));
         playSound('card');
     };

     if (currentStage === GameStage.PREFLOP) {
         deal(3); // Flop
         await new Promise(r => setTimeout(r, 800));
         deal(1); // Turn
         await new Promise(r => setTimeout(r, 800));
         deal(1); // River
     } else if (currentStage === GameStage.FLOP) {
         deal(1);
         await new Promise(r => setTimeout(r, 800));
         deal(1);
     } else if (currentStage === GameStage.TURN) {
         deal(1);
     }

     setGameState(prev => ({ ...prev, stage: GameStage.SHOWDOWN, communityCards: community }));
     setTimeout(handleShowdown, 1000);
  };

  const handleShowdown = () => {
    setGameState(prev => ({ ...prev, stage: GameStage.SHOWDOWN, currentTurnIndex: -1 }));
    
    const activePlayers = players.filter(p => !p.hasFolded && (p.chips > 0 || p.totalHandBet > 0)); // Must have bet something or be active
    
    if (activePlayers.length === 0) {
        declareWinner([]);
        return;
    }

    if (activePlayers.length === 1) {
        declareWinner([activePlayers[0].id]);
        return;
    }

    // Evaluate hands
    let bestScore = -1;
    let winners: number[] = [];
    let bestHandInfo: HandResult | null = null;

    activePlayers.forEach(p => {
       const result = evaluateHand(p.cards, gameState.communityCards);
       if (result.score > bestScore) {
           bestScore = result.score;
           winners = [p.id];
           bestHandInfo = result;
       } else if (result.score === bestScore) {
           winners.push(p.id);
       }
    });

    setWinningHandResult(bestHandInfo);
    setTimeout(() => declareWinner(winners), 1000);
  };

  const declareWinner = (winnerIds: number[]) => {
      sendRoundEnd({
          tableId: 'table-1',
          roundNumber: gameState.roundNumber,
          gameState,
          players,
          winners: winnerIds,
      }).then(response => {
          if (response) {
              setGameState(prev => ({ ...prev, ...response.gameState }));
              setPlayers(response.players);
          }
      });

      setGameState(prev => ({ ...prev, winners: winnerIds }));
      
      const winnerCount = winnerIds.length;
      if (winnerCount === 0) {
          setTimeout(startNewHand, 3000);
          return;
      }

      playSound('win');
      
      const prize = Math.floor(gameState.pot / winnerCount);
      
      // Animation Source: Pot area
      const potRect = tableRef.current?.getBoundingClientRect();
      const startX = potRect ? potRect.width * 0.75 : window.innerWidth * 0.75;
      const startY = potRect ? potRect.height * 0.5 : window.innerHeight * 0.5;

      const seatPositions = [
          {x: window.innerWidth * 0.5, y: window.innerHeight * 0.8}, // Seat 0 Bottom
          {x: window.innerWidth * 0.1, y: window.innerHeight * 0.5}, // Seat 1 Left
          {x: window.innerWidth * 0.5, y: window.innerHeight * 0.2}, // Seat 2 Top
          {x: window.innerWidth * 0.9, y: window.innerHeight * 0.5}, // Seat 3 Right
      ];
      const target = seatPositions[winnerIds[0]];
      setShowChipAnim({ start: {x: startX, y: startY}, target });

      setTimeout(() => {
          setPlayers(prev => prev.map(p => {
              if (winnerIds.includes(p.id)) {
                  return { ...p, chips: p.chips + prize };
              }
              return p;
          }));
          setShowChipAnim(null);
      }, 800);

      setTimeout(startNewHand, 5000);
  };

  const startNewHand = () => {
    setWinningHandResult(null);
    setNotification('');
    setDeck([]);
    
    // In MP, bots play automatically, so we don't pause for players.
    // In SP, we might have paused, but effectively we always run bots now.

    // Move Dealer
    const nextDealer = (gameState.dealerIndex + 1) % PLAYER_COUNT;
    const sbIndex = (nextDealer + 1) % PLAYER_COUNT;
    const bbIndex = (nextDealer + 2) % PLAYER_COUNT;

    // Handle "Spectator" joining in Single Player (at start of hand)
    let updatedPlayers = [...players];
    if (pendingPlayerName && gameMode === GameMode.SINGLEPLAYER && pendingPlayerName.seat === 0) {
        updatedPlayers[0] = { ...updatedPlayers[0], name: pendingPlayerName.name, isHuman: true, chips: INITIAL_CHIPS };
        setIsSpectating(false);
        setPendingPlayerName(null);
    } else if (gameMode === GameMode.SINGLEPLAYER && isSpectating) {
        updatedPlayers[0].name = 'Bot User';
        updatedPlayers[0].isHuman = false;
    }

    // Bot Loans & Reset State
    updatedPlayers = updatedPlayers.map(p => {
        let chips = p.chips;
        // Bot Loan: Infinite money for bots in SP and MP if they bust (to keep game going)
        if (!p.isHuman && chips === 0) {
            chips = INITIAL_CHIPS; 
            if (p.id !== 0) p.actionText = '貸款 (Loan)';
        }
        return {
            ...p,
            chips: chips,
            bet: 0,
            totalHandBet: 0,
            cards: [],
            hasFolded: false,
            isDealer: p.id === nextDealer,
            isActive: false,
            actionText: p.actionText === '貸款 (Loan)' ? '貸款 (Loan)' : undefined
        };
    });

    // Blinds
    const sbPlayer = updatedPlayers[sbIndex];
    const bbPlayer = updatedPlayers[bbIndex];

    const sbAmt = Math.min(sbPlayer.chips, SMALL_BLIND);
    const bbAmt = Math.min(bbPlayer.chips, BIG_BLIND);

    sbPlayer.chips -= sbAmt;
    sbPlayer.bet = sbAmt;
    sbPlayer.totalHandBet = sbAmt;

    bbPlayer.chips -= bbAmt;
    bbPlayer.bet = bbAmt;
    bbPlayer.totalHandBet = bbAmt;

    const pot = sbAmt + bbAmt;

    // Deal Cards
    const seed = Date.now();
    const newDeck = createDeck(seed);
    const hands: Card[][] = [[], [], [], []];
    
    // Deal 2 cards
    for (let i = 0; i < 2; i++) {
        for (let p = 0; p < PLAYER_COUNT; p++) {
             hands[p].push(newDeck.shift()!);
        }
    }

    updatedPlayers.forEach((p, i) => {
        p.cards = hands[i];
    });

    setDeck(newDeck);
    setPlayers(updatedPlayers);
    setGameState({
        stage: GameStage.PREFLOP,
        pot,
        communityCards: [],
        deckSeed: seed,
        currentTurnIndex: (bbIndex + 1) % PLAYER_COUNT,
        dealerIndex: nextDealer,
        highestBet: BIG_BLIND,
        minRaise: BIG_BLIND,
        winners: [],
        roundNumber: gameState.roundNumber + 1
    });

    playSound('card');
    setTimeout(() => advanceTurn((bbIndex + 1) % PLAYER_COUNT), 500);
  };

  const botTurn = (player: Player) => {
      // Basic AI
      const currentBet = player.bet;
      const callAmt = gameState.highestBet - currentBet;
      
      let aggression = 0.5;
      if (player.name.includes('Alpha')) aggression = 0.8;
      if (player.name.includes('Beta')) aggression = 0.2;
      
      const rng = Math.random();
      let action: 'fold' | 'check' | 'call' | 'raise' | 'allin' = 'fold';
      let amount = 0;

      if (callAmt === 0) {
          if (rng < aggression && player.chips > BIG_BLIND) {
              action = 'raise';
              amount = gameState.highestBet + BIG_BLIND * 2;
          } else {
              action = 'check';
          }
      } else {
          if (callAmt > player.chips) {
               action = (rng < aggression + 0.1) ? 'allin' : 'fold';
          } else {
               if (rng < 0.2 && callAmt > BIG_BLIND * 5) action = 'fold';
               else if (rng < aggression * 0.6) {
                   action = 'raise';
                   amount = gameState.highestBet + callAmt + BIG_BLIND; 
               } else {
                   action = 'call';
               }
          }
      }

      if (action === 'raise' && amount > 0) handleAction(player.id, 'raise', amount);
      else if (action === 'allin') handleAction(player.id, 'allin', player.chips);
      else if (action === 'call') handleAction(player.id, 'call');
      else if (action === 'check') handleAction(player.id, 'check');
      else handleAction(player.id, 'fold');
  };

  const activePlayer = gameState.currentTurnIndex >= 0 ? players[gameState.currentTurnIndex] : null;
  const isMyTurn = activePlayer?.isHuman && !activePlayer.hasFolded && gameState.stage !== GameStage.SHOWDOWN;
  const canCheck = activePlayer ? (gameState.highestBet <= activePlayer.bet) : false;
  const canRaise = activePlayer ? (activePlayer.chips > (gameState.highestBet - activePlayer.bet)) : false;

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 overflow-hidden relative select-none font-sans" ref={tableRef}>
      
      {/* --- Header --- */}
      <div className="absolute top-0 left-0 right-0 p-2 md:p-4 z-50 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
            <h1 className="text-xl md:text-3xl font-display font-bold text-yellow-500 tracking-tight drop-shadow-md">
              Instant Texas Hold'em
            </h1>
            <h2 className="text-xs md:text-sm text-slate-400 font-bold tracking-widest uppercase">即時德州撲克</h2>
            <div className="flex items-center gap-3 mt-1 text-[10px] md:text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1"><Hash size={10} /> 局數: {gameState.roundNumber}</span>
                <span className="flex items-center gap-1"><Clock size={10} /> {timeStr}</span>
            </div>
        </div>

        {/* Mode Toggle */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
             <div className="bg-slate-800 rounded-lg p-1 flex gap-1 border border-slate-700 shadow-lg items-stretch">
                 <button 
                    onClick={() => switchGameMode(GameMode.SINGLEPLAYER)}
                    className={`px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-bold transition-all ${gameMode === GameMode.SINGLEPLAYER ? 'bg-yellow-500 text-black shadow' : 'text-slate-400 hover:text-white'}`}
                 >
                    單人 (Single)
                 </button>
                 <button 
                    onClick={() => switchGameMode(GameMode.MULTIPLAYER)}
                    className={`px-2 py-1 md:px-3 md:py-1.5 rounded text-[10px] md:text-xs font-bold transition-all ${gameMode === GameMode.MULTIPLAYER ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                 >
                    多人 (Multi)
                 </button>
             </div>
             
             {/* Recovery Input */}
             <div className="flex items-center gap-1 bg-slate-800/80 backdrop-blur rounded p-1 border border-slate-700 w-full justify-between">
                <form onSubmit={handleRecoverySubmit} className="flex items-center w-full">
                    <input 
                        type="password" 
                        value={recoveryCode}
                        onChange={e => setRecoveryCode(e.target.value)}
                        className="bg-transparent border-none outline-none text-[10px] md:text-xs w-full text-white px-1"
                    />
                    <button type="submit" className="text-yellow-500 hover:text-yellow-400">
                        <RotateCcw size={12} />
                    </button>
                </form>
             </div>
        </div>
      </div>

      {/* --- Notification Toast --- */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800/90 text-yellow-400 px-4 py-2 rounded-full border border-yellow-500/30 shadow-lg z-50 text-xs md:text-sm font-bold animate-pulse">
          {notification}
        </div>
      )}

      {/* --- Poker Table --- */}
      <div className="absolute inset-0 flex items-center justify-center p-8 md:p-8">
        <div className="relative w-full max-w-[95%] md:max-w-6xl aspect-[1.8/1] md:aspect-[2/1] bg-[#0f382a] rounded-[3rem] md:rounded-[10rem] border-[8px] md:border-[16px] border-[#1a2e35] shadow-[inset_0_0_80px_rgba(0,0,0,0.8),0_20px_50px_rgba(0,0,0,0.5)] felt-texture">
          
          {/* Table Logo (Watermark) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
             <span className="font-display font-black text-6xl md:text-8xl text-white tracking-widest whitespace-nowrap">即時撲克</span>
          </div>

          {/* --- INFO PANELS (ON FELT) --- */}
          
          <div className="absolute left-4 top-6 md:left-32 md:top-24 w-24 h-14 md:w-48 md:h-32 border-2 border-yellow-500/30 rounded-lg bg-black/20 flex flex-col items-center justify-center text-center p-1 md:p-2 backdrop-blur-sm z-0">
             <h3 className="text-yellow-500 font-bold text-[10px] md:text-sm mb-0.5 md:mb-1 leading-none">獲勝 WINNER</h3>
             {winningHandResult ? (
                 <div className="animate-in fade-in zoom-in duration-500">
                     <div className="text-white font-bold text-xs md:text-xl leading-tight truncate w-full px-1">
                         {gameState.winners.map(id => players[id].name).join('&')}
                     </div>
                     <div className="text-emerald-400 text-[9px] md:text-sm mt-0.5 md:mt-1 leading-none">
                         {winningHandResult.description}
                     </div>
                 </div>
             ) : (
                 <div className="text-slate-500/50 text-[10px] md:text-xs">- - -</div>
             )}
          </div>

          <div className="absolute right-4 bottom-6 md:right-32 md:bottom-24 w-24 h-14 md:w-48 md:h-32 border-2 border-slate-500/30 rounded-lg bg-black/20 flex flex-col items-center justify-center text-center p-1 md:p-2 backdrop-blur-sm z-0">
             <h3 className="text-slate-400 font-bold text-[10px] md:text-sm mb-0.5 md:mb-1 leading-none">底池 POT</h3>
             <div className="text-yellow-400 font-mono font-bold text-sm md:text-3xl flex items-center gap-1 md:gap-2 justify-center">
                 <Trophy size={12} className="md:w-6 md:h-6" />
                 {gameState.pot.toLocaleString()}
             </div>
          </div>

          {/* --- Community Cards --- */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 md:gap-3 z-10">
            {gameState.communityCards.map((card, i) => (
               <CardComponent 
                 key={card.key} 
                 card={card} 
                 className="shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500" 
                 size="md"
                 isWinning={winningHandResult?.winningCards.some(c => c.key === card.key)}
                 isDimmed={winningHandResult ? !winningHandResult.winningCards.some(c => c.key === card.key) : false}
               />
            ))}
          </div>

          {/* --- Seats --- */}
          {/* Seat 0 (Bottom - User) - Horizontal Layout */}
          <PlayerSeat 
            seatIndex={0}
            player={players[0]} 
            isActive={gameState.currentTurnIndex === 0} 
            gameStage={gameState.stage}
            positionClass="bottom-[-1rem] md:bottom-[-2rem] left-1/2 -translate-x-1/2"
            orientation="horizontal"
            isSpectating={gameMode === GameMode.SINGLEPLAYER && isSpectating}
            onJoin={handleJoinQueue}
            winningCards={winningHandResult?.winningCards}
            isWinner={gameState.winners.includes(0)}
            pendingName={pendingPlayerName?.seat === 0 ? pendingPlayerName.name : null}
            gameMode={gameMode}
          />

          {/* Seat 1 (Left) - Horizontal Layout - Centered Vertical */}
          <PlayerSeat 
            seatIndex={1}
            player={players[1]} 
            isActive={gameState.currentTurnIndex === 1} 
            gameStage={gameState.stage}
            positionClass="left-2 md:left-12 top-1/2 -translate-y-1/2"
            orientation="horizontal"
            isSpectating={false}
            onJoin={handleJoinQueue}
            winningCards={winningHandResult?.winningCards}
            isWinner={gameState.winners.includes(1)}
            gameMode={gameMode}
          />

          {/* Seat 2 (Top) - Horizontal Layout */}
          <PlayerSeat 
            seatIndex={2}
            player={players[2]} 
            isActive={gameState.currentTurnIndex === 2} 
            gameStage={gameState.stage}
            positionClass="top-[-1rem] md:top-[-2rem] left-1/2 -translate-x-1/2"
            orientation="horizontal"
            isSpectating={false}
            onJoin={handleJoinQueue}
            winningCards={winningHandResult?.winningCards}
            isWinner={gameState.winners.includes(2)}
            gameMode={gameMode}
          />

          {/* Seat 3 (Right) - Horizontal Layout - Centered Vertical */}
          <PlayerSeat 
            seatIndex={3}
            player={players[3]} 
            isActive={gameState.currentTurnIndex === 3} 
            gameStage={gameState.stage}
            positionClass="right-2 md:right-12 top-1/2 -translate-y-1/2"
            orientation="horizontal"
            isSpectating={false}
            onJoin={handleJoinQueue}
            winningCards={winningHandResult?.winningCards}
            isWinner={gameState.winners.includes(3)}
            gameMode={gameMode}
          />

        </div>
      </div>

      {/* --- Controls --- */}
      {isMyTurn && activePlayer && activePlayer.chips > 0 && (
        <GameControls 
          onCall={() => handleAction(activePlayer.id, 'call')}
          onFold={() => handleAction(activePlayer.id, 'fold')}
          onCheck={() => handleAction(activePlayer.id, 'check')}
          onRaise={(amt) => handleAction(activePlayer.id, 'raise', amt)}
          canCheck={canCheck}
          canRaise={canRaise}
          callAmount={gameState.highestBet - activePlayer.bet}
          minRaise={Math.max(gameState.minRaise + gameState.highestBet, gameState.highestBet * 2)}
          maxRaise={activePlayer.chips + activePlayer.bet}
          playerChips={activePlayer.chips}
          disabled={false}
        />
      )}

      {/* --- Bankruptcy Modal (Only for User in SinglePlayer) --- */}
      {gameMode === GameMode.SINGLEPLAYER && !isSpectating && players[0].chips === 0 && !gameState.winners.includes(0) && gameState.stage === GameStage.IDLE && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
             <div className="bg-slate-800 p-6 rounded-xl border border-red-500/50 shadow-2xl text-center max-w-sm">
                 <h2 className="text-xl font-bold text-red-500 mb-2">破產 BANKRUPT</h2>
                 <p className="text-sm text-slate-300 mb-4">輸入密碼 '123' 以重生</p>
                 <form onSubmit={handleRecoverySubmit}>
                    <input 
                        type="password" 
                        value={recoveryCode} 
                        onChange={e => setRecoveryCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-center text-white mb-2"
                        placeholder="Password"
                    />
                    <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded">Recover</button>
                 </form>
             </div>
         </div>
      )}

      {/* --- Chip Animation --- */}
      {showChipAnim && <CoinParticles start={showChipAnim.start} target={showChipAnim.target} />}

    </div>
  );
};

export default App;
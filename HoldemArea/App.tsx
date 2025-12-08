import React, { useState, useEffect, useRef } from 'react';
import { Card, GameStage, Player, GameState, HandRank, HandResult } from './types';
import { INITIAL_CHIPS, SMALL_BLIND, BIG_BLIND, PLAYER_COUNT, ANIMATION_DELAY, RECOVERY_PASSWORD, MAX_ALLIN } from './constants';
import { createDeck, evaluateHand } from './services/pokerEngine';
import { playSound } from './services/soundService';
import { PlayerSeat } from './components/PlayerSeat';
import { CardComponent } from './components/CardComponent';
import { GameControls } from './components/GameControls';
import { joinRoom, startHandOnline } from './services/onlineService';
import { Trophy, Clock, Hash, CheckCircle } from 'lucide-react';

// --- Particle/Chip Animation Component ---
const CoinParticles = ({ start, target }: { start: { x: number, y: number }, target: { x: number, y: number } }) => {
    // Generate 20 particles
    const particles = Array.from({ length: 20 });
    return (
        <div className="fixed inset-0 pointer-events-none z-[60]">
            {particles.map((_, i) => {
                const delay = i * 0.05;
                return (
                    <div
                        key={i}
                        className="absolute w-4 h-4 bg-yellow-400 rounded-full border border-yellow-600 shadow-md"
                        style={{
                            left: start.x,
                            top: start.y,
                            transition: `all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s`,
                            opacity: 1,
                        }}
                        ref={el => {
                            if (el) {
                                // Force reflow
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
  const [isSpectating, setIsSpectating] = useState(true);
  // Queue for next round
  const [pendingPlayerName, setPendingPlayerName] = useState<string | null>(null);
  
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
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [onlinePlayerIndex, setOnlinePlayerIndex] = useState<number | null>(null);

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
    if (gameState.stage === GameStage.IDLE && !gameLoopRef.current) {
        // Initial start
        setTimeout(startNewHand, 1000);
        gameLoopRef.current = true;
    }
  }, []);

  // --- Logic ---

  const handleJoinQueueOnline = async (name: string) => {
      try {
          const res = await joinRoom(name);
          setOnlinePlayerIndex(res.playerIndex);
          setIsSpectating(false);
          setNotification(`歡迎 ${name}! 已加入線上牌桌`);
      } catch (error) {
          setNotification('線上入座失敗，請稍後再試');
      }
  };

  const handleJoinQueue = (name: string) => {
      if (isOnlineMode) {
          handleJoinQueueOnline(name);
          return;
      }
      setPendingPlayerName(name);
      setNotification(`歡迎 ${name}! 請等待下一局開始...`);
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (recoveryCode.toLowerCase() === RECOVERY_PASSWORD) {
          if (!isSpectating) {
            setPlayers(prev => prev.map(p => p.id === 0 ? { ...p, chips: INITIAL_CHIPS } : p));
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
    // If fewer than 2 players have chips (meaning everyone else is All-In or Folded), 
    // and we aren't already at Showdown, just run it out.
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
    
    // Animate cards dealing
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
    // Skip folded players AND players with 0 chips (All-In)
    while ((players[nextIndex].hasFolded || players[nextIndex].chips === 0) && attempts < 5) {
       nextIndex = (nextIndex + 1) % PLAYER_COUNT;
       attempts++;
    }

    const notFolded = players.filter(p => !p.hasFolded);
    if (notFolded.length === 1) {
       handleShowdown(); 
       return;
    }

    // Check if we should auto-progress because everyone remaining is All-In
    const activeWithChips = notFolded.filter(p => p.chips > 0);
    if (activeWithChips.length === 0) {
        // Everyone is All-In (and bets are matched if we got here from handleAction)
        // Wait a beat then run out
        setTimeout(runOutBoard, 1000);
        return;
    }

    setGameState(prev => ({ ...prev, currentTurnIndex: nextIndex }));
  };

  const handleAction = (playerId: number, action: 'check' | 'call' | 'raise' | 'fold' | 'allin', amount: number = 0) => {
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
      // Logic constraint: Cap at 3000
      let raiseTo = amount;
      if (raiseTo > MAX_ALLIN) raiseTo = MAX_ALLIN;
      
      // But we can't raise less than highest bet unless all-in
      if (raiseTo < gameState.highestBet && player.chips + player.bet > raiseTo) {
          raiseTo = gameState.highestBet; // Fallback correction
      }

      const amountToAdd = raiseTo - player.bet;
      // Double check chips
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

    const notFolded = updatedPlayers.filter(p => !p.hasFolded);
    if (notFolded.length === 1) {
      setTimeout(() => declareWinner([notFolded[0].id]), 1000);
      return;
    }

    // Check if remaining players can act
    const activePlayersWithChips = notFolded.filter(p => p.chips > 0);
    const allMatched = notFolded.every(p => p.bet === newHighestBet || p.chips === 0);
    
    // If everyone matches, and fewer than 2 people have chips left to bet (e.g. 1 Active vs 1 All-In, or 2 All-Ins)
    // We run out the board.
    if (allMatched && activePlayersWithChips.length < 2) {
       runOutBoard();
       return;
    }

    const bbIndex = (gameState.dealerIndex + 2) % PLAYER_COUNT;
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

     // Determine missing cards based on CURRENT stage, not just blindly dealing
     if (currentStage === GameStage.PREFLOP) { 
         deal(3); await wait(500); // Flop
         deal(1); await wait(500); // Turn
         deal(1); // River
     }
     else if (currentStage === GameStage.FLOP) { 
         deal(1); await wait(500); // Turn
         deal(1); // River
     }
     else if (currentStage === GameStage.TURN) { 
         deal(1); // River
     }
     
     await wait(1000);
     handleShowdown(community);
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleShowdown = (finalCommunity?: Card[]) => {
    setGameState(prev => ({ ...prev, stage: GameStage.SHOWDOWN, communityCards: finalCommunity || prev.communityCards }));
    
    const activePlayers = players.filter(p => !p.hasFolded);
    const results = activePlayers.map(p => ({
        id: p.id,
        handResult: evaluateHand(p.cards, finalCommunity || gameState.communityCards)
    }));
    
    results.sort((a, b) => {
        if (a.handResult.rank !== b.handResult.rank) return b.handResult.rank - a.handResult.rank;
        return b.handResult.score - a.handResult.score;
    });
    
    const winnerResult = results[0];
    const winners = results.filter(r => r.handResult.rank === winnerResult.handResult.rank && Math.abs(r.handResult.score - winnerResult.handResult.score) < 0.01);
    
    setWinningHandResult(winnerResult.handResult);
    setGameState(prev => ({ ...prev, winningHand: winnerResult.handResult.description }));
    declareWinner(winners.map(w => w.id));
  };

  const declareWinner = (winnerIds: number[]) => {
      setGameState(prev => ({ ...prev, winners: winnerIds }));
      const winAmount = Math.floor(gameState.pot / winnerIds.length);
      
      // Trigger animations
      const tableCenter = tableRef.current ? { 
          x: tableRef.current.getBoundingClientRect().left + tableRef.current.offsetWidth / 2, 
          y: tableRef.current.getBoundingClientRect().top + tableRef.current.offsetHeight / 2 
      } : { x: window.innerWidth/2, y: window.innerHeight/2 };

      const winnerIdx = winnerIds[0];
      const targetX = winnerIdx === 0 ? tableCenter.x : (winnerIdx === 1 ? tableCenter.x - 300 : (winnerIdx === 2 ? tableCenter.x : tableCenter.x + 300));
      const targetY = winnerIdx === 0 ? tableCenter.y + 200 : (winnerIdx === 2 ? tableCenter.y - 200 : tableCenter.y);
      
      setShowChipAnim({ start: tableCenter, target: { x: targetX, y: targetY }});
      playSound('win');

      setPlayers(prev => prev.map(p => {
          if (winnerIds.includes(p.id)) {
              return { ...p, chips: p.chips + winAmount };
          }
          return p;
      }));

      // Auto restart
      setTimeout(() => startNewHand(), 6000);
  };

  // --- AI Logic ---
  useEffect(() => {
    if (isOnlineMode) return;
    if (gameState.stage === GameStage.IDLE || gameState.stage === GameStage.SHOWDOWN || gameState.winners.length > 0) return;

    const currentPlayer = players[gameState.currentTurnIndex];
    const isAiTurn = isSpectating || currentPlayer.id !== 0;

    if (currentPlayer && isAiTurn && !currentPlayer.hasFolded && currentPlayer.chips > 0) {
        
        const aiAction = () => {
           const r = Math.random();
           const callCost = gameState.highestBet - currentPlayer.bet;
           
           let action: 'fold' | 'check' | 'call' | 'raise' | 'allin' = 'fold';
           let amount = 0;

           if (callCost === 0) {
               if (r > 0.8) {
                   action = 'raise';
                   amount = gameState.highestBet + BIG_BLIND; 
               } else {
                   action = 'check';
               }
           } else {
               if (r > 0.3) {
                   action = 'call';
               } else if (r > 0.1) {
                   action = 'fold';
               } else {
                   action = 'raise';
                   amount = gameState.highestBet + Math.max(BIG_BLIND, callCost);
               }
           }
           
           if (action === 'raise') {
               if (currentPlayer.chips < amount || currentPlayer.chips < gameState.highestBet + BIG_BLIND) {
                   // If bot doesn't have enough, it calls or folds usually, or all in
                   if (r > 0.5) action = 'allin';
                   else action = 'call';
               }
               
               if (amount > MAX_ALLIN) amount = MAX_ALLIN;
           }

           handleAction(currentPlayer.id, action, amount);
        };

        const delay = isSpectating ? 800 : ANIMATION_DELAY;
        turnTimeoutRef.current = setTimeout(aiAction, delay);
    }
    return () => { if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current); };
  }, [gameState.currentTurnIndex, gameState.stage, gameState.highestBet, isSpectating, isOnlineMode]); 

  // --- Init ---
  const startNewHandOnline = async () => {
    if (!isOnlineMode) return;
    try {
      const { room } = await startHandOnline();
      const deckSeed = room.deckSeed;
      const newDeck = createDeck(deckSeed);

      setShowChipAnim(null);
      setWinningHandResult(null);

      setPlayers(prev => {
        const dealed = prev.map(p => {
          const serverPlayer = room.players[p.id] ?? room.players[0];
          return {
            ...p,
            chips: serverPlayer.chips,
            bet: serverPlayer.bet,
            totalHandBet: serverPlayer.totalHandBet,
            hasFolded: serverPlayer.hasFolded,
            isDealer: p.id === room.dealerIndex,
            cards: [newDeck.pop()!, newDeck.pop()!],
            isActive: true,
            // Keep loan text if present, otherwise clear
            actionText: p.actionText === '貸款 (Loan)' ? '貸款 (Loan)' : undefined,
          };
        });
        return dealed;
      });

      const bbIndex = (room.dealerIndex + 2) % PLAYER_COUNT;
      const firstActionIndex = (bbIndex + 1) % PLAYER_COUNT;

      setDeck(newDeck);
      setGameState(prev => ({
        stage: GameStage.PREFLOP,
        pot: room.pot,
        communityCards: [],
        deckSeed,
        currentTurnIndex: firstActionIndex,
        dealerIndex: room.dealerIndex,
        highestBet: room.highestBet,
        minRaise: BIG_BLIND,
        winners: [],
        winningHand: undefined,
        roundNumber: prev.roundNumber + 1,
      }));
      setNotification(`第 ${gameState.roundNumber + 1} 局開始`);
    } catch (error) {
      setNotification('線上開局失敗，請稍後再試');
    }
  };

  const startNewHand = () => {
    if (isOnlineMode) {
      startNewHandOnline();
      return;
    }

    setShowChipAnim(null);
    setWinningHandResult(null);

    // 1. Handle Join Queue
    let currentPlayers = [...players];
    let newSpectatingState = isSpectating;

    if (pendingPlayerName) {
        currentPlayers[0] = { ...currentPlayers[0], name: pendingPlayerName, isHuman: true, chips: INITIAL_CHIPS };
        setPendingPlayerName(null);
        newSpectatingState = false;
        setIsSpectating(false);
    }

    // 2. Check Bankruptcy
    currentPlayers = currentPlayers.map(p => {
         // Human logic
         if (p.id === 0) {
             if (p.chips === 0 && !newSpectatingState) {
                 setNotification("你破產了! 強制離座 (Bankrupt - Spectator Mode)");
                 setIsSpectating(true);
                 newSpectatingState = true;
                 return { ...p, isHuman: false, name: 'Bot User', chips: INITIAL_CHIPS };
             }
         }
         // Bot logic: Rebuy with Loan visual
         if (p.chips === 0 && p.id !== 0) {
             return { ...p, chips: INITIAL_CHIPS, actionText: '貸款 (Loan)' }; 
         }
         return p;
    });

    setPlayers(currentPlayers);

    const nextDealer = (gameState.dealerIndex + 1) % PLAYER_COUNT;
    const newDeck = createDeck(Date.now()); 
    playSound('card'); // Deal sound
    
    setPlayers(prev => {
        const dealed = prev.map(p => ({
            ...p,
            cards: [newDeck.pop()!, newDeck.pop()!],
            hasFolded: false,
            bet: 0,
            totalHandBet: 0,
            isDealer: false, 
            // Keep loan text if present, otherwise clear
            actionText: p.actionText === '貸款 (Loan)' ? '貸款 (Loan)' : undefined,
            isActive: true,
        }));
        
        dealed.forEach(p => p.isDealer = p.id === nextDealer);
        
        const sbIndex = (nextDealer + 1) % PLAYER_COUNT;
        const bbIndex = (nextDealer + 2) % PLAYER_COUNT;
        
        let sbAmount = Math.min(dealed[sbIndex].chips, SMALL_BLIND);
        dealed[sbIndex].chips -= sbAmount;
        dealed[sbIndex].bet = sbAmount;
        dealed[sbIndex].totalHandBet = sbAmount;

        let bbAmount = Math.min(dealed[bbIndex].chips, BIG_BLIND);
        dealed[bbIndex].chips -= bbAmount;
        dealed[bbIndex].bet = bbAmount;
        dealed[bbIndex].totalHandBet = bbAmount;

        return dealed;
    });

    const bbIndex = (nextDealer + 2) % PLAYER_COUNT;
    const firstActionIndex = (bbIndex + 1) % PLAYER_COUNT;

    setDeck(newDeck);
    setGameState(prev => ({
        stage: GameStage.PREFLOP,
        pot: SMALL_BLIND + BIG_BLIND,
        communityCards: [],
        deckSeed: Date.now(),
        currentTurnIndex: firstActionIndex,
        dealerIndex: nextDealer,
        highestBet: BIG_BLIND,
        minRaise: BIG_BLIND,
        winners: [],
        winningHand: undefined,
        roundNumber: prev.roundNumber + 1
    }));
    setNotification(`第 ${gameState.roundNumber + 1} 局開始`);
  };

  // --- Render ---
  const localPlayerIndex = isOnlineMode && onlinePlayerIndex !== null ? onlinePlayerIndex : 0;
  const humanPlayer = players[localPlayerIndex];
  const canAct = !isSpectating && gameState.currentTurnIndex === localPlayerIndex && gameState.winners.length === 0 && humanPlayer.chips > 0;
  const currentCallAmount = gameState.highestBet - humanPlayer.bet;
  
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 overflow-hidden relative selection:bg-yellow-500/30">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

      {/* Chip Animation */}
      {showChipAnim && <CoinParticles start={showChipAnim.start} target={showChipAnim.target} />}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-30 pointer-events-none">
        <div className="pointer-events-auto">
            <h1 className="text-2xl font-display font-bold text-yellow-500 drop-shadow-md">
                Instant Texas Hold'em
                <span className="block text-xs text-slate-400 font-sans mt-[-2px]">即時德州撲克</span>
            </h1>
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-1"><Hash size={12}/> 局數: {gameState.roundNumber}</div>
                <div className="flex items-center gap-1"><Clock size={12}/> {timeStr}</div>
            </div>
        </div>

        {/* Password Recovery Input */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
            <button
                type="button"
                onClick={() => setIsOnlineMode(prev => !prev)}
                className="text-xs px-2 py-1 rounded-md border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700"
            >
                {isOnlineMode ? '模式：線上 4 人' : '模式：單機 / 與機器人'}
            </button>
            <div className="text-xs text-slate-400">Blinds: {SMALL_BLIND}/{BIG_BLIND}</div>
            <form onSubmit={handleRecoverySubmit} className="flex gap-1 bg-slate-800/80 p-1 rounded-md border border-slate-700 backdrop-blur-sm">
                <input 
                    type="text" 
                    placeholder="輸入密碼領錢" 
                    className="bg-transparent text-xs text-white px-2 py-1 outline-none w-24"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                />
                <button type="submit" className="text-yellow-500 hover:text-white px-1">
                    <CheckCircle size={14} />
                </button>
            </form>
        </div>
      </div>
      
      {/* Notifications */}
      {notification && (
        <div className="absolute top-20 left-0 right-0 text-center z-40 pointer-events-none">
             <span className="inline-block px-6 py-2 bg-slate-800/90 backdrop-blur-md rounded-full text-sm font-medium border border-yellow-500/30 text-yellow-100 shadow-lg animate-fade-in-up">
                {notification}
             </span>
        </div>
      )}

      {/* Game Table Area */}
      <div className="relative w-full h-screen flex items-center justify-center perspective-1000 overflow-hidden">
        
        {/* The Table */}
        <div ref={tableRef} className="relative w-[90vw] max-w-[900px] h-[55vh] max-h-[480px] bg-emerald-900 rounded-[200px] border-[12px] border-slate-800 shadow-2xl flex items-center justify-center felt-texture shadow-[inset_0_0_80px_rgba(0,0,0,0.7)]">
            
            {/* Left Box: Winner Info (Merged) */}
            <div className={`absolute top-1/2 -translate-y-1/2 left-[12%] w-[160px] border-2 rounded-lg flex flex-col items-center justify-center p-3 transition-opacity duration-500 backdrop-blur-sm z-20 ${gameState.winners.length > 0 ? 'border-yellow-500 bg-black/60 opacity-100' : 'border-white/5 opacity-0 pointer-events-none'}`}>
                {gameState.winners.length > 0 && (
                    <>
                        <div className="text-yellow-400 text-xs font-bold uppercase mb-1">{gameState.winners.length > 1 ? "平手 Tie" : "獲勝 Winner"}</div>
                        <div className="text-white text-lg font-bold truncate w-full text-center mb-1">{gameState.winners.map(id => players[id].name).join(', ')}</div>
                        {winningHandResult && (
                             <div className="text-emerald-300 text-sm font-medium border-t border-white/20 pt-1 w-full text-center">{winningHandResult.description}</div>
                        )}
                    </>
                )}
            </div>

            {/* Right Box: Pot Info */}
            <div className="absolute top-1/2 -translate-y-1/2 right-[12%] w-[160px] border-2 border-slate-600/50 rounded-lg flex flex-col items-center justify-center p-3 bg-black/40 backdrop-blur-sm z-20">
                <div className="text-slate-400 text-xs font-bold uppercase mb-1">底池 Pot</div>
                <div className="flex items-center gap-2 text-yellow-400 font-mono text-2xl font-bold">
                    <Trophy size={20} className="text-yellow-600" />
                    {gameState.pot.toLocaleString()}
                </div>
            </div>

            {/* Center Info: Community Cards */}
            <div className="flex flex-col items-center justify-center z-10 space-y-4">
                <div className="flex gap-2 min-h-[100px] items-center">
                    {gameState.communityCards.map((card, idx) => (
                        <CardComponent 
                            key={idx} 
                            card={card} 
                            className="animate-pop-in" 
                            isWinning={gameState.stage === GameStage.SHOWDOWN && winningHandResult?.winningCards.some(wc => wc.suit === card.suit && wc.rank === card.rank)}
                            isDimmed={gameState.stage === GameStage.SHOWDOWN && winningHandResult && !winningHandResult?.winningCards.some(wc => wc.suit === card.suit && wc.rank === card.rank)}
                        />
                    ))}
                </div>
            </div>

            {/* Players Positions */}
            <PlayerSeat 
                player={players[0]} 
                isActive={gameState.currentTurnIndex === 0} 
                gameStage={gameState.stage}
                positionClass="bottom-[-60px] left-1/2 -translate-x-1/2 z-20"
                orientation="horizontal"
                isSpectating={isSpectating}
                onJoin={handleJoinQueue}
                winningCards={winningHandResult?.winningCards}
                isWinner={gameState.winners.includes(0)}
                pendingName={pendingPlayerName}
            />
            <PlayerSeat 
                player={players[1]} 
                isActive={gameState.currentTurnIndex === 1} 
                gameStage={gameState.stage}
                positionClass="left-[-40px] top-1/2 -translate-y-1/2 md:left-[-60px]"
                isSpectating={false}
                winningCards={winningHandResult?.winningCards}
                isWinner={gameState.winners.includes(1)}
            />
            <PlayerSeat 
                player={players[2]} 
                isActive={gameState.currentTurnIndex === 2} 
                gameStage={gameState.stage}
                positionClass="top-[-60px] left-1/2 -translate-x-1/2"
                orientation="horizontal"
                isSpectating={false}
                winningCards={winningHandResult?.winningCards}
                isWinner={gameState.winners.includes(2)}
            />
            <PlayerSeat 
                player={players[3]} 
                isActive={gameState.currentTurnIndex === 3} 
                gameStage={gameState.stage}
                positionClass="right-[-40px] top-1/2 -translate-y-1/2 md:right-[-60px]"
                isSpectating={false}
                winningCards={winningHandResult?.winningCards}
                isWinner={gameState.winners.includes(3)}
            />
        </div>
      </div>

      {/* Controls */}
      {!isSpectating && gameState.stage !== GameStage.IDLE && gameState.winners.length === 0 && (
          <GameControls
            onCall={() => handleAction(localPlayerIndex, 'call')}
            onFold={() => handleAction(localPlayerIndex, 'fold')}
            onRaise={(amount) => handleAction(localPlayerIndex, 'raise', amount)}
            onCheck={() => handleAction(localPlayerIndex, 'check')}
            canCheck={currentCallAmount === 0}
            canRaise={humanPlayer.chips > gameState.highestBet + BIG_BLIND}
            callAmount={currentCallAmount}
            minRaise={gameState.highestBet + BIG_BLIND}
            maxRaise={humanPlayer.chips + humanPlayer.bet} 
            playerChips={humanPlayer.chips}
            disabled={!canAct}
          />
      )}

    </div>
  );
};

export default App;
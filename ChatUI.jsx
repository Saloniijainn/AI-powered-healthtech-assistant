import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
// Icons
import { FiSend, FiThumbsUp, FiThumbsDown, FiUser, FiTrash2, FiPhone, FiMic, FiMicOff, FiVolume2, FiVolumeX, FiSun, FiMoon } from "react-icons/fi";
import { BsRobot, BsStars } from "react-icons/bs";

// Utility for smooth scrolling
const scrollToBottom = (element) => {
    element.current?.scrollIntoView({ behavior: "smooth", block: "end" });
};

export default function ChatUI() {
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState([
        {
            sender: "bot",
            text: "✨ **Welcome to Wellbot!** I'm your personalized wellness assistant. I can help you with health checkups, wellness programs, and answer any questions about Welleazy's services. How can I assist you today?",
            timestamp: new Date(),
            id: 0
        },
    ]);
    const [loading, setLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);

    const [suggestions, setSuggestions] = useState([
        "🏥 What health services do you offer? ",
        "📅 How can I book a health checkup? ",
        "💪 Tell me about wellness programs ",
    ]);

    const [messageReviews, setMessageReviews] = useState({});
    const [typing, setTyping] = useState(false);

    // Voice feature states
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [currentlyReading, setCurrentlyReading] = null; // Changed initial state to null
    const [femaleVoice, setFemaleVoice] = useState(null);

    const [darkMode, setDarkMode] = useState(false);

    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);

    // useEffect to load and select a female voice
    useEffect(() => {
        if (!('speechSynthesis' in window)) {
            setSpeechSupported(false);
            return;
        }

        const populateVoiceList = () => {
            const voices = window.speechSynthesis.getVoices();
            let selectedVoice = null;
            for (let i = 0; i < voices.length; i++) {
                if (voices[i].lang.startsWith('en') &&
                    (voices[i].name.toLowerCase().includes('female') ||
                     voices[i].name.toLowerCase().includes('ellen') ||
                     voices[i].name.toLowerCase().includes('zira') ||
                     voices[i].name.toLowerCase().includes('heather'))
                ) {
                    selectedVoice = voices[i];
                    break;
                }
            }
            if (!selectedVoice) {
                 for (let i = 0; i < voices.length; i++) {
                    if (voices[i].lang.startsWith('en')) {
                        selectedVoice = voices[i];
                        break;
                    }
                }
            }
            setFemaleVoice(selectedVoice);
            setSpeechSupported(true);
        };

        populateVoiceList();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoiceList;
        }

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    const handleBotSpeak = useCallback((text, messageId) => {
        if (!voiceEnabled || !speechSupported || !('speechSynthesis' in window) || !femaleVoice) {
            console.warn("Speech synthesis not enabled, supported, or female voice not found.");
            return;
        }

        window.speechSynthesis.cancel();
        setCurrentlyReading(messageId);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = femaleVoice.lang;
        utterance.voice = femaleVoice;

        utterance.onend = () => {
            setCurrentlyReading(null);
        };
        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            setCurrentlyReading(null);
        };
        window.speechSynthesis.speak(utterance);
    }, [voiceEnabled, speechSupported, femaleVoice]);

    const stopBotSpeak = useCallback(() => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setCurrentlyReading(null);
        }
    }, []);

    const handleClearChat = useCallback(() => {
        setMessages([
            {
                sender: "bot",
                text: "✨ **Welcome to Wellbot!** I'm your personalized wellness assistant. I can help you with health checkups, wellness programs, and answer any questions about Welleazy's services. How can I assist you today?",
                timestamp: new Date(),
                id: 0
            },
        ]);
        setSuggestions([
            "🏥 What health services do you offer? ",
            "📅 How can I book a health checkup? ",
            "💪 Tell me about wellness programs ",
        ]);
        setMessageReviews({});
        setQuery("");
        setLoading(false);
        setTyping(false);
        setShowWelcome(true);
        stopBotSpeak();
    }, [stopBotSpeak]);

    const handleAsk = useCallback(async (textToProcess = query) => {
        const currentQuery = textToProcess.trim();
        if (!currentQuery || loading) return;

        stopBotSpeak();

        setLoading(true);
        setTyping(true);
        setQuery("");

        const userMessage = {
            sender: "user",
            text: currentQuery,
            timestamp: new Date(),
            id: Date.now(),
            status: "sending",
        };

        setMessages((prev) => [...prev, userMessage]);

        if (currentQuery.toLowerCase().includes("clear chat") ||
            currentQuery.toLowerCase().includes("reset chat") ||
            currentQuery.toLowerCase().includes("start over")) {
            setTimeout(() => {
                handleClearChat();
                setLoading(false);
                setTyping(false);
            }, 500);
            return;
        }

        try {
            const response = await fetch("http://localhost:5000/ask", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: currentQuery }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Backend error: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            const botAnswer = data.answer || "Sorry, I couldn't get a response from the knowledge base.";
            const escalateFlag = data.escalate || false;
            const escalationReason = data.escalation_reason || null;

            const botMessage = {
                sender: "bot",
                text: botAnswer,
                timestamp: new Date(),
                id: Date.now() + 1,
                escalate: escalateFlag,
                escalationReason: escalationReason
            };
            setMessages((prev) => {
                const updatedPrev = prev.map((msg) =>
                    msg.id === userMessage.id ? { ...msg, status: "delivered" } : msg
                );
                const finalMessages = [...updatedPrev, botMessage];

                if (voiceEnabled && botMessage.text) {
                    handleBotSpeak(botMessage.text, botMessage.id);
                }
                return finalMessages;
            });
            setSuggestions(prev => prev.filter(s =>
                s.toLowerCase() !== currentQuery.toLowerCase()
            ));
        } catch (error) {
            console.error("Error asking question:", error);
            const errorMessage = {
                sender: "bot",
                text: `It seems I need some human help with that. I'm unable to connect to the backend server. Please check your server and network connection. (Reason: Frontend network error during API call.)`,
                timestamp: new Date(),
                id: Date.now() + 1,
                escalate: true,
                escalationReason: "Frontend network error during API call."
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setTyping(false);
            setLoading(false);
            scrollToBottom(bottomRef);
        }
    }, [loading, query, voiceEnabled, handleBotSpeak, stopBotSpeak, handleClearChat]);

    useEffect(() => {
        if (!speechSupported || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
            setIsListening(true);
            setQuery("");
            stopBotSpeak();
        };

        recognitionRef.current.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.results.length -1 ; i >= event.resultIndex ; --i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setQuery(finalTranscript || interimTranscript);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };
        recognitionRef.current.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current.onend = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onstart = null;
                recognitionRef.current.onerror = null;
            }
        };
    }, [speechSupported, stopBotSpeak]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && speechSupported && voiceEnabled) {
            setQuery('');
            recognitionRef.current.start();
        }
    }, [speechSupported, voiceEnabled]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            if (query.trim() !== "") {
                handleAsk(query);
            }
        }
    }, [query, handleAsk]);

    const toggleVoiceEnabled = useCallback(() => {
        setVoiceEnabled(prev => {
            const newState = !prev;
            if (!newState) {
                stopBotSpeak();
                stopListening();
            }
            return newState;
        });
    }, [stopBotSpeak, stopListening]);

    const handleReview = useCallback(async (messageId, helpful) => {
        setMessageReviews((prev) => ({ ...prev, [messageId]: helpful ? 'helpful' : 'not-helpful' }));

        const messageToReview = messages.find(msg => msg.id === messageId);
        if (!messageToReview) return;

        let userQueryForLog = 'N/A';
        const botMessageIndex = messages.findIndex(msg => msg.id === messageId);
        if (botMessageIndex > 0 && messages[botMessageIndex - 1].sender === 'user') {
            userQueryForLog = messages[botMessageIndex - 1].text;
        }

        try {
            await fetch("http://localhost:5000/log_feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messageId,
                    feedback: helpful ? '👍' : '👎',
                    query: userQueryForLog,
                    botResponse: messageToReview.text,
                    escalated: messageToReview.escalate || false,
                    escalationReason: messageToReview.escalationReason || null
                }),
            });
            console.log(`Feedback ${helpful ? '👍' : '👎'} logged for message ${messageId}`);
            if (!helpful) {
                const followUpMessage = {
                    sender: "bot",
                    text: "Thank you for the feedback! I'm constantly learning. For more complex queries, you can contact our Human AI Manager for better assistance:\n\n**Direct Contact:** +91-88840 00687\n\nWhat specific information were you looking for? I'll do my best to help you better!",
                    timestamp: new Date(),
                    id: Date.now() + 2,
                    escalate: true,
                    escalationReason: "User marked bot response as not helpful"
                };
                setMessages((prev) => [...prev, followUpMessage]);
                if (voiceEnabled) {
                    handleBotSpeak(followUpMessage.text, followUpMessage.id);
                }
            }
        } catch (error) {
            console.error("Error logging feedback:", error);
        }
    }, [messages, voiceEnabled, handleBotSpeak]);

    const handleSuggestionClick = useCallback((suggestion) => {
        setQuery(suggestion);
        setTimeout(() => {
            handleAsk(suggestion);
        }, 100);
    }, [handleAsk]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typing]);

    useEffect(() => {
        if (!showWelcome && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showWelcome]);

    const renderMessageContent = useCallback((msg) => {
        return (
            <ReactMarkdown
                children={typeof msg.text === 'string' ? msg.text.trim() : String(msg.text).trim()}
                components={{
                    p: ({ node, ...props }) => <p className="mb-3 leading-relaxed" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc ml-5 mb-3 mt-3 space-y-1.5" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1.5" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                    a: ({ node, ...props }) => (
                        <a
                            // Adjusted link color to Welleazy Blue
                            className={`${msg.sender === 'user' ? 'text-blue-200 hover:text-blue-100' : 'text-blue-700 hover:text-blue-800'} underline font-medium transition-colors`}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                        >
                            {props.children}
                        </a>
                    ),
                }}
            />
        );
    }, []);

    const renderMessageAvatar = useCallback((sender) => {
        switch (sender) {
            case 'bot':
                // Adjusted bot avatar gradient to Welleazy Blue shades
                return (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-lg animate-bubble-pop flex-shrink-0">
                        <BsRobot className="text-sm" aria-label="Bot avatar" />
                    </div>
                );
            case 'human':
                return (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white shadow-lg animate-bubble-pop flex-shrink-0">
                        <FiPhone className="text-sm" aria-label="Human agent avatar" />
                    </div>
                );
            case 'user':
                // User avatar gradient adjusted to orange shades
                return (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center text-white shadow-lg animate-bubble-pop flex-shrink-0">
                        <FiUser className="text-sm" aria-label="User avatar" />
                    </div>
                );
            default:
                return null;
        }
    }, []);

    const getMessageBubbleStyle = useCallback((sender) => {
        switch (sender) {
            case 'user':
                // User message gradient adjusted to Welleazy Blue and Vibrant Orange
                return 'bg-gradient-to-r from-blue-700 to-orange-600 text-white rounded-br-sm';
            case 'human':
                return 'bg-green-100 text-green-800 rounded-bl-sm border border-green-200';
            default: // bot
                // Bot message background in light mode changed to 'bg-white/90' and border to 'border-gray-300'
                return darkMode ? 'bg-gray-700/90 text-gray-100 rounded-bl-sm border border-gray-600 shadow-sm' : 'bg-white/90 text-gray-800 rounded-bl-sm border border-gray-300 shadow-sm';
        }
    }, [darkMode]);

    const renderTypingIndicator = useCallback(() => {
        if (typing) {
            return (
                <div className="flex items-center gap-3 mb-4">
                    {renderMessageAvatar('bot')}
                    <div className={`${darkMode ? 'bg-gray-700/90 border-gray-600' : 'bg-white/90 border-gray-300'} backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3 shadow-lg border`}>
                        <div className="flex items-center space-x-3">
                            {/* Typing indicator dots with Welleazy Blue and Vibrant Orange */}
                            <div className="h-2 w-2 bg-blue-700 rounded-full animate-bounce"></div>
                            <div className="h-2 w-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Typing indicator avatar with Welleazy Blue and Vibrant Orange */}
                            <div className="h-6 w-6 rounded-full bg-gradient-to-r from-blue-600 to-orange-500 flex items-center justify-center animate-spin">
                                <BsStars className="text-xs text-white" />
                            </div>
                            <span className={`${darkMode ? 'text-gray-200' : 'text-gray-600'} text-sm font-medium`}>Wellbot is analyzing...</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    }, [typing, renderMessageAvatar, darkMode]);

    const groupMessagesByDateAndMinute = useCallback((msgs) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups = {};
        msgs.forEach(msg => {
            const msgDate = new Date(msg.timestamp);
            let dateLabel;

            if (msgDate.toDateString() === today.toDateString()) {
                dateLabel = "Today";
            } else if (msgDate.toDateString() === yesterday.toDateString()) {
                dateLabel = "Yesterday";
            } else {
                dateLabel = msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }

            const timeLabel = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const key = `${dateLabel}, ${timeLabel}`;

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(msg);
        });
        return groups;
    }, []);

    return (
        // Main page background changed to Light Gray / White
        <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center p-4 font-sans transition-colors duration-300`}>
            {/* Main container border adjusted to Border Gray */}
            <div className={`w-full max-w-4xl ${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'} backdrop-blur-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors duration-300`} style={{ height: '85vh' }}>

                {showWelcome && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className={`${darkMode ? 'bg-gray-700/95 border-gray-600 text-gray-100' : 'bg-white/95 border-gray-300 text-gray-800'} backdrop-blur-md p-8 rounded-2xl shadow-2xl text-center max-w-md mx-4 border transition-colors duration-300`}>
                            <div className="mb-4">
                                {/* Welcome icon color remains */}
                                <BsStars className="text-4xl text-blue-600 mx-auto mb-2" aria-label="Stars icon" />
                                <h2 className="text-2xl font-bold mb-2">Welcome to Wellbot</h2>
                                {/* Text color adjusted to Text Gray */}
                                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-6`}>Your intelligent wellness companion, powered by Welleazy. I'm here to guide you through your health journey with personalized assistance and expert insights.</p>
                            </div>
                            <div className="flex gap-4 mb-6">
                                <div className="flex-1 text-center">
                                    <FiSend className="text-xl text-blue-600 mx-auto mb-1" aria-label="Send icon" />
                                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>Instant Answers</p>
                                </div>
                                <div className="flex-1 text-center">
                                    <FiUser className="text-xl text-red-500 mx-auto mb-1" aria-label="User icon" />
                                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>Personalized</p>
                                </div>
                                <div className="flex-1 text-center">
                                    <FiTrash2 className="text-xl text-green-600 mx-auto mb-1" aria-label="Trash icon" />
                                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>Easy Reset</p>
                                </div>
                            </div>
                            {/* Welcome button gradient adjusted to Welleazy Blue and Vibrant Orange */}
                            <button
                                className="px-6 py-3 bg-gradient-to-r from-blue-700 to-orange-600 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-orange-700 transition-all duration-300 transform hover:scale-105"
                                onClick={() => setShowWelcome(false)}
                                aria-label="Start your wellness journey"
                            >
                                Start Your Wellness Journey
                            </button>
                        </div>
                    </div>
                )}

                {/* Header gradient adjusted to Welleazy Blue and Vibrant Orange */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 via-blue-800 to-orange-600 text-white">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center animate-pop-in">
                                <BsRobot className="text-xl" aria-label="Wellbot avatar" />
                            </div>
                            <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-400 rounded-full border-2 border-white animate-pulse" title="Online"></div>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Wellbot</h1>
                            <p className="text-sm text-white/80">Your Wellness Assistant</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setDarkMode(prev => !prev)}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            aria-label={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
                        </button>

                        {speechSupported && (
                            <button
                                onClick={toggleVoiceEnabled}
                                className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                                title={voiceEnabled ? "Disable Voice Input & Output" : "Enable Voice Input & Output"}
                                aria-label={voiceEnabled ? "Disable Voice" : "Enable Voice"}
                            >
                                {voiceEnabled ? <FiVolume2 /> : <FiVolumeX />}
                            </button>
                        )}
                        <button
                            onClick={handleClearChat}
                            className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition-all duration-200"
                            title="Clear chat"
                            aria-label="Clear chat"
                        >
                            <FiTrash2 />
                        </button>
                    </div>
                </div>

                {/* Chat area background adjusted for light mode */}
                <div className={`flex-1 overflow-y-auto px-6 py-4 ${darkMode ? 'bg-gray-900/30' : 'bg-gradient-to-b from-transparent to-gray-50/30'} transition-colors duration-300`}>
                    {Object.entries(groupMessagesByDateAndMinute(messages)).map(([timeAndDate, group]) => (
                        <div key={timeAndDate} className="mb-6">
                            {/* Timestamp background and text adjusted for neutral colors */}
                            <div className={`${darkMode ? 'text-gray-400 bg-gray-700/50' : 'text-gray-500 bg-gray-100'} text-xs text-center rounded-full px-3 py-1 w-fit mx-auto mb-4 mt-4 transition-colors duration-300`}>{timeAndDate}</div>
                            {group.map((msg) => (
                                <div key={msg.id} className={`flex items-start gap-3 mb-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.sender !== 'user' && renderMessageAvatar(msg.sender)}
                                    <div className={`max-w-md ${msg.sender === 'user' ? 'order-first' : ''}`}>
                                        <div className={`rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm border ${getMessageBubbleStyle(msg.sender)}`}>
                                            {/* Text color in bot message adjusted to Text Gray */}
                                            <div className={`prose prose-sm max-w-none ${msg.sender === 'user' ? 'text-white' : (darkMode ? 'text-gray-100' : 'text-gray-700')}`}>
                                                {renderMessageContent(msg)}
                                            </div>
                                            {/* Thumbs up/down review buttons for bot messages */}
                                            {msg.sender === 'bot' && !messageReviews[msg.id] && msg.id !== 0 && (
                                                <div className="flex gap-2 mt-3 justify-end">
                                                    <button
                                                        onClick={() => handleReview(msg.id, true)}
                                                        className="p-1.5 rounded-full text-green-500 hover:bg-green-100 transition-colors duration-200"
                                                        title="Mark as helpful"
                                                        aria-label="Mark message as helpful"
                                                    >
                                                        <FiThumbsUp size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReview(msg.id, false)}
                                                        className="p-1.5 rounded-full text-red-500 hover:bg-red-100 transition-colors duration-200"
                                                        title="Mark as not helpful"
                                                        aria-label="Mark message as not helpful"
                                                    >
                                                        <FiThumbsDown size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            {messageReviews[msg.id] && (
                                                <div className={`mt-2 text-xs ${messageReviews[msg.id] === 'helpful' ? 'text-green-600' : 'text-red-600'} text-right`}>
                                                    Feedback: {messageReviews[msg.id] === 'helpful' ? 'Helpful 👍' : 'Not helpful 👎'}
                                                </div>
                                            )}
                                            {/* Voice controls for bot messages */}
                                            {msg.sender === 'bot' && voiceEnabled && (
                                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                                                    <span className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>Read aloud:</span>
                                                    <button
                                                        onClick={() => currentlyReading === msg.id ? stopBotSpeak() : handleBotSpeak(msg.text, msg.id)}
                                                        className={`p-1 rounded-full transition-all duration-200 ml-auto ${
                                                            currentlyReading === msg.id ?
                                                                'bg-blue-100 text-blue-600' : (darkMode ? 'text-gray-400 hover:text-blue-400 hover:bg-gray-600' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50')
                                                        }`}
                                                        aria-label={currentlyReading === msg.id ? "Stop reading" : "Read aloud"}
                                                    >
                                                        {currentlyReading === msg.id ? <FiVolumeX size={16} /> : <FiVolume2 size={16} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {msg.sender === 'user' && renderMessageAvatar(msg.sender)}
                                </div>
                            ))}
                        </div>
                    ))}
                    {renderTypingIndicator()}
                    <div ref={bottomRef} />
                </div>

                {/* Suggestions background and text adjusted */}
                {suggestions.length > 0 && (
                    <div className={`${darkMode ? 'bg-gray-800/80 border-gray-700' : 'bg-white/80 border-gray-300'} px-6 pb-2 pt-4 backdrop-blur-sm border-t flex flex-wrap gap-2 overflow-x-auto scrollbar-hide transition-colors duration-300`}>
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={`${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 flex-shrink-0 shadow-sm`}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}

                {/* Chat Input */}
                <div className={`${darkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-300'} p-4 backdrop-blur-sm border-t flex items-center gap-3 transition-colors duration-300`}>
                    {speechSupported && (
                        <button
                            onClick={isListening ? stopListening : startListening}
                            className={`p-3 rounded-full transition-all duration-200 shadow-md ${
                                isListening ? 'bg-red-500 text-white animate-pulse' : (darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                            }`}
                            aria-label={isListening ? "Stop listening" : "Start voice input"}
                            title={isListening ? "Stop listening" : "Start voice input"}
                        >
                            {isListening ? <FiMicOff size={20} /> : <FiMic size={20} />}
                        </button>
                    )}
                    <input
                        type="text"
                        ref={inputRef}
                        // Input border and focus ring adjusted
                        className={`${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600 focus:ring-blue-400' : 'bg-gray-50 text-gray-800 border-gray-300 focus:ring-blue-700'} flex-1 p-3 rounded-xl border focus:outline-none focus:ring-2 shadow-sm transition-all duration-200`}
                        placeholder={isListening ? "Listening..." : "Ask Wellbot anything..."}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === "Enter" && !loading) {
                                handleAsk();
                            }
                        }}
                        disabled={loading || isListening}
                        aria-label="Chat input"
                    />
                    <button
                        onClick={() => handleAsk()}
                        // Send button gradient adjusted to Welleazy Blue and Vibrant Orange
                        className="p-3 bg-gradient-to-r from-blue-700 to-orange-600 text-white rounded-xl shadow-md hover:from-blue-800 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || query.trim() === "" || isListening}
                        aria-label="Send message"
                    >
                        {loading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <FiSend size={20} />
                        )}
                    </button>
                </div>

                <style jsx>{`
                    .scrollbar-hide {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                    .scrollbar-hide::-webkit-scrollbar {
                        display: none;
                    }

                    @keyframes pop-in {
                        0% {
                            transform: scale(0.8);
                            opacity: 0;
                        }
                        100% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }

                    @keyframes bubble-pop {
                        0% {
                            transform: scale(0.8);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.1);
                        }
                        100% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }

                    /* NEW: Message Slide-in Animation */
                    @keyframes slide-in-message {
                        0% {
                            opacity: 0;
                            transform: translateY(20px);
                        }
                        100% {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    .animate-pop-in {
                        animation: pop-in 0.3s ease-out;
                    }

                    .animate-bubble-pop {
                        animation: bubble-pop 0.5s ease-out;
                    }

                    /* NEW: Apply slide-in-message animation */
                    .animate-slide-in-message {
                        animation: slide-in-message 0.4s ease-out;
                    }
                `}</style>
            </div>
        </div>
    );
}
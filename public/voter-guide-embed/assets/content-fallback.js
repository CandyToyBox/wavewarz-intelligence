window.WAVEWARZ_CONTENT = {
  "meta": {
    "title": "WaveWarz Voter Onboarding | W3M Creator Academy",
    "description": "Beginner-safe onboarding for voting in the August 23 WaveWarZ Featured Battle."
  },
  "brand": {
    "mark": "W",
    "primary": "WaveWarz",
    "secondary": "Produced by Web3 Metal"
  },
  "brandHome": "WaveWarz home",
  "nav": {
    "ariaLabel": "Course sections",
    "items": [
      {
        "label": "Get Phantom",
        "href": "#why-wallet"
      },
      {
        "label": "Battle Night",
        "href": "#battle-night"
      },
      {
        "label": "FAQ",
        "href": "#faq"
      }
    ]
  },
  "home": {
    "eyebrow": "W3M Creator Academy",
    "time": "Estimated total time: 15-25 minutes",
    "title": "Get ready to vote in the August 23 WaveWarZ Featured Battle.",
    "body": "Voting is free. You do not need crypto experience. Phantom is a wallet app. For this guide, think of it like your voter pass for WaveWarZ. It lets the site confirm a real wallet is participating without asking for your personal info.",
    "actionsAria": "Primary actions",
    "actions": [
      {
        "label": "Start the guide",
        "href": "#why-wallet",
        "variant": "primary"
      },
      {
        "label": "Download Phantom",
        "href": "#",
        "variant": "secondary",
        "urlKey": "phantom"
      },
      {
        "label": "Open WaveWarz",
        "href": "#",
        "variant": "secondary",
        "urlKey": "wavewarz"
      },
      {
        "label": "Set an X Spaces reminder",
        "href": "#",
        "variant": "secondary",
        "urlKey": "x-spaces"
      }
    ],
    "checklistHelper": {
      "title": "Already have Phantom?",
      "body": "Skip setup and use the battle night checklist to make sure you are ready.",
      "action": {
        "label": "Check battle night readiness",
        "href": "#battle-night",
        "variant": "secondary"
      }
    }
  },
  "readiness": {
    "ariaLabel": "Readiness tracker",
    "title": "Your voter readiness",
    "body": "Finish each step before August 23. A tiny amount of SOL may be needed for network activity, but voting itself is free.",
    "resetLabel": "Reset progress"
  },
  "trustStrip": {
    "ariaLabel": "Core reminders",
    "items": [
      "Voting is free.",
      "No crypto experience needed.",
      "Phantom helps reduce botting.",
      "Be ready before battle night."
    ]
  },
  "successCallout": {
    "ariaLabel": "Free voting reminder",
    "title": "Good news",
    "body": "Voting is free. You are not buying a vote. Phantom helps ensure votes come from real participants and reduces botting."
  },
  "sections": {
    "whyWallet": {
      "step": "Step 1",
      "time": "Estimated time: 5 minutes",
      "title": "Get Phantom Ready",
      "body": "Phantom is a wallet app. For this guide, think of it like your voter pass for WaveWarZ. It lets the site confirm that a real wallet is participating without asking for your personal info.",
      "deviceChooser": {
        "title": "How will you be voting?",
        "body": "Choose the setup that matches the device you'll use on battle night.",
        "cards": [
          {
            "title": "Desktop Computer",
            "items": [
              "Install the Phantom browser extension.",
              "On battle night, open wavewarz.com in your web browser.",
              "Connect your Phantom wallet when prompted."
            ],
            "action": {
              "label": "Download browser extension",
              "href": "https://phantom.com/download",
              "variant": "primary"
            }
          },
          {
            "title": "Mobile Phone",
            "items": [
              "Install the Phantom app from your app store.",
              "On battle night, open wavewarz.com using Phantom's built in browser.",
              "Connect your Phantom wallet when prompted."
            ],
            "action": {
              "label": "Download mobile app",
              "href": "https://phantom.com/download",
              "variant": "primary"
            }
          }
        ]
      },
      "screenshotLabel": "Drop image here: assets/install-phantom.png",
      "screenshotPath": "assets/install-phantom.png",
      "screenshotAlt": "Official Phantom download page or app store listing.",
      "cards": [
        {
          "title": "Voting is free",
          "body": "Phantom helps reduce botting and keeps the vote cleaner."
        },
        {
          "title": "Beginner warning",
          "body": "Never share your Secret Recovery Phrase. WaveWarz, Web3 Metal, and Phantom should never ask for it.",
          "variant": "warning"
        }
      ],
      "instructions": [
        {
          "number": "1",
          "body": "Choose the device you plan to use on battle night."
        },
        {
          "number": "2",
          "body": "Install the correct Phantom option for that device: browser extension for desktop, app for mobile."
        },
        {
          "number": "3",
          "body": "Use only official app stores, official extension stores, or the official Phantom website. Ignore ads, fake support accounts, and random download links."
        }
      ],
      "handoff": "Once Phantom is installed, open it and continue to the next step to create your wallet.",
      "completion": {
        "id": "phantom-ready",
        "label": "I installed Phantom or know where to install it safely."
      }
    },
    "createWallet": {
      "step": "Step 2",
      "time": "Estimated time: About 2 minutes",
      "title": "Create Your Wallet and Protect Your Phrase",
      "body": "After Phantom is installed, open it and follow these beginner steps.",
      "screenshotLabel": "Drop image here: assets/create-wallet.png",
      "screenshotPath": "assets/create-wallet.png",
      "screenshotAlt": "Phantom wallet creation screen with private phrase hidden.",
      "instructions": [
        {
          "number": "1",
          "body": "Open Phantom."
        },
        {
          "number": "2",
          "body": "Choose Create a New Wallet."
        },
        {
          "number": "3",
          "body": "Create a password for this device."
        },
        {
          "number": "4",
          "body": "Write down your Secret Recovery Phrase and store it somewhere safe."
        },
        {
          "number": "5",
          "body": "Confirm the phrase if Phantom asks you to."
        },
        {
          "number": "6",
          "body": "Your wallet is ready."
        }
      ],
      "callouts": [
        {
          "title": "Password vs Secret Recovery Phrase",
          "body": "Your Phantom password unlocks Phantom on this device. Your Secret Recovery Phrase is the backup for the wallet itself. Write the phrase down and keep it safe. Do not share it, screenshot it, or paste it anywhere."
        }
      ],
      "callout": {
        "variant": "danger",
        "title": "Never share your Secret Recovery Phrase.",
        "items": [
          "Never send it in Discord or X DMs.",
          "Never screenshot it.",
          "Never enter it into WaveWarz.",
          "WaveWarz and Phantom support will never ask for it."
        ]
      },
      "completion": {
        "id": "create-wallet",
        "label": "I created my wallet and stored my phrase safely."
      }
    },
    "addSol": {
      "step": "Step 3",
      "time": "Estimated time: 3 minutes",
      "title": "Add a Small Amount of SOL",
      "body": "SOL is the digital currency that powers the Solana network. Voting is free. You are not paying to vote or investing in crypto. A small amount of SOL simply covers any network fees that may be required while voting.",
      "screenshotLabel": "Drop image here: assets/add-sol.png",
      "screenshotPath": "assets/add-sol.png",
      "screenshotAlt": "Phantom balance area showing where a small SOL amount appears.",
      "splitPanels": [
        {
          "title": "A beginner-safe amount",
          "body": "About $5 USD worth of SOL is more than enough for most first-time voters. If the voting process does not require a network transaction, you may not use any of your SOL at all. It is simply there in case a small network fee is needed."
        },
        {
          "title": "Good to know",
          "body": "If you already have SOL in Phantom, you can skip this step. If you are unsure, ask the official WaveWarz or Web3 Metal community before August 23."
        }
      ],
      "completion": {
        "id": "add-sol",
        "label": "I understand SOL only covers possible network activity and voting is free."
      }
    },
    "connectWavewarz": {
      "step": "Step 4",
      "time": "Estimated time: 2 minutes on battle night",
      "title": "Connect to WaveWarZ When the Voting Page Opens",
      "body": "Connecting means WaveWarZ can see your wallet address so you can participate in voting. It does not mean WaveWarZ has your Secret Recovery Phrase.",
      "deviceChooser": {
        "title": "Choose your connection path",
        "body": "Use the instructions for the device you will vote with on battle night.",
        "cards": [
          {
            "title": "Desktop Computer",
            "items": [
              "Go to https://wavewarz.com in your browser.",
              "Make sure the Phantom browser extension is installed.",
              "Click Connect Wallet or the wallet connection button on WaveWarZ.",
              "Choose Phantom if asked.",
              "Approve the connection in the Phantom popup."
            ],
            "action": {
              "label": "Open WaveWarZ",
              "href": "https://wavewarz.com",
              "variant": "primary"
            }
          },
          {
            "title": "Mobile Phone",
            "items": [
              "Open the Phantom app.",
              "Tap the browser tab inside Phantom.",
              "Go to https://wavewarz.com from inside the Phantom browser.",
              "Tap Connect Wallet or the wallet connection button on WaveWarZ.",
              "Approve the connection when Phantom asks."
            ],
            "action": {
              "label": "Open Phantom, then use its browser",
              "href": "https://wavewarz.com",
              "variant": "primary"
            }
          }
        ]
      },
      "screenshotLabel": "Drop image here: assets/connect-wavewarz.png",
      "screenshotPath": "assets/connect-wavewarz.png",
      "screenshotAlt": "WaveWarz connect wallet button and Phantom approval prompt.",
      "callouts": [
        {
          "variant": "danger",
          "title": "Protect your recovery phrase",
          "body": "Connecting your wallet is not the same as sharing your Secret Recovery Phrase. Never enter your Secret Recovery Phrase into WaveWarZ, Discord, X, DMs, or any website."
        },
        {
          "title": "Pause if anything feels unclear",
          "body": "If a prompt looks confusing or asks for something you do not understand, stop and ask the official WaveWarZ or Web3 Metal community before approving."
        }
      ],
      "completion": {
        "id": "connect-wavewarz",
        "label": "I know how I will connect Phantom to WaveWarz."
      }
    },
    "battleNight": {
      "step": "August 23",
      "time": "Estimated time: 5 minutes once voting opens",
      "title": "Battle Night Mission Checklist",
      "body": "When the live event starts, use this checklist as your action plan for joining, connecting, voting, and enjoying the show.",
      "actions": [
        {
          "label": "Set an X Spaces reminder",
          "href": "#",
          "variant": "secondary",
          "urlKey": "x-spaces"
        },
        {
          "label": "Open WaveWarz",
          "href": "#",
          "variant": "primary",
          "urlKey": "wavewarz"
        }
      ],
      "missions": [
        {
          "id": "battle-x-space",
          "title": "1. Join the X Space",
          "body": "Listen for live updates and timing."
        },
        {
          "id": "battle-open-wavewarz",
          "title": "2. Open wavewarz.com",
          "body": "Use the official WaveWarz link only."
        },
        {
          "id": "battle-connect-phantom",
          "title": "3. Connect Phantom",
          "body": "Approve the voting connection when prompted."
        },
        {
          "id": "battle-vote",
          "title": "4. Vote",
          "body": "Pick your favorite AI music battle entry."
        },
        {
          "id": "battle-enjoy",
          "title": "5. Enjoy the show",
          "body": "Stay in the room and support the artists."
        }
      ]
    },
    "missionComplete": {
      "title": "Mission Complete",
      "badge": "100% Ready",
      "subtitle": "You're ready for battle night.",
      "body": "Your wallet setup is done. Now the final step is showing up live, listening to the battles, and voting when the round opens.",
      "checklistTitle": "Setup complete",
      "checklist": [
        "Phantom installed",
        "Wallet created",
        "SOL ready if needed",
        "Ready to connect",
        "Ready to vote"
      ],
      "event": {
        "title": "Hurric4n3Ike vs GodCloud",
        "details": [
          "August 23, 2026",
          "7:00 PM EST",
          "WaveWarZ Featured Battle"
        ]
      },
      "actions": [
        {
          "label": "Set an X Spaces Reminder",
          "href": "https://x.com/WaveWarZ/status/2087557097168802239?s=20",
          "variant": "primary"
        },
        {
          "label": "Open WaveWarZ",
          "href": "https://wavewarz.com",
          "variant": "secondary"
        }
      ],
      "finalLine": "Produced by Web3 Metal."
    },
    "faq": {
      "step": "Help",
      "time": "Estimated time: 3 minutes",
      "title": "Beginner FAQ",
      "body": "Short answers for voters who are new to Web3.",
      "items": [
        {
          "question": "Do I need crypto experience?",
          "answer": "No. This guide is built for complete beginners.",
          "open": true
        },
        {
          "question": "Does voting cost money?",
          "answer": "Voting is free. A tiny amount of SOL may be needed for network activity, depending on the voting flow."
        },
        {
          "question": "Why Phantom?",
          "answer": "Phantom helps reduce botting and keeps the vote cleaner by making it harder for fake activity to flood the tournament."
        },
        {
          "question": "What should I never share?",
          "answer": "Never share your Secret Recovery Phrase. Anyone who asks for it should not be trusted."
        }
      ]
    }
  },
  "footer": {
    "titleStrong": "WaveWarz",
    "titleRest": "voter onboarding",
    "help": "Questions? Join the WaveWarz community or Web3 Metal community for help."
  },
  "urls": {
    "phantom": "https://phantom.com/download",
    "wavewarz": "https://wavewarz.com",
    "x-spaces": "https://x.com/WaveWarZ/status/2087557097168802239?s=20"
  }
};

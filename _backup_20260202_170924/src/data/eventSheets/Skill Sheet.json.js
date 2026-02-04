export const Skill_Sheet = {
  "name": "Skill Sheet",
  "events": [
    {
      "functionName": "Party_DEF_UP",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "turns",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 199344763471112
        },
        {
          "name": "addAmt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 597349933116430
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 845003341876575,
      "children": [
        {
          "eventType": "variable",
          "name": "amt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 853093809154212
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 354416385193584,
              "parameters": {
                "variable": "amt",
                "value": "int(addAmt)"
              }
            }
          ],
          "sid": 903636019960035
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 361577315624129,
              "parameters": {
                "variable": "PartyBuff_DEF",
                "value": "min(PartyBuffCap_DEF, PartyBuff_DEF+amt)"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 785695232089358,
              "parameters": {
                "variable": "BuffApplyClock",
                "value": "1"
              }
            }
          ],
          "sid": 396190035823622
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 870009184378997,
              "parameters": {
                "variable": "BuffExpire_DEF",
                "value": "HeroTurnClock+turns"
              }
            }
          ],
          "sid": 580800452773337
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "newdebugger",
              "sid": 514483513615848,
              "parameters": {
                "text": "\"ApplyPartyBuff_DEF\" & \", amt=\" & amt & \", after=\" & PartyBuff_DEF & \", cap=\" & PartyBuffCap_DEF"
              }
            },
            {
              "callFunction": "RegisterPartyBuffSlot",
              "sid": 546693185704588,
              "parameters": [
                "0"
              ]
            },
            {
              "callFunction": "HideAttackUI",
              "sid": 861231933135501
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 569838464024184
            }
          ],
          "sid": 148896447501349
        }
      ]
    },
    {
      "functionName": "Party_ATK_UP",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "turns",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 134136617619669
        },
        {
          "name": "addAmt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 363665244818246
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 754362500327760,
      "children": [
        {
          "eventType": "variable",
          "name": "amt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 893273579450133
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 253889097030419,
              "parameters": {
                "variable": "amt",
                "value": "int(addAmt)"
              }
            }
          ],
          "sid": 940544581176473
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 687594226594256,
              "parameters": {
                "variable": "PartyBuff_ATK",
                "value": "min(PartyBuffCap_ATK, PartyBuff_ATK+amt)"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 471807356309576,
              "parameters": {
                "variable": "BuffApplyClock",
                "value": "1"
              }
            }
          ],
          "sid": 589252238586517
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 618810301432685,
              "parameters": {
                "variable": "BuffExpire_ATK",
                "value": "HeroTurnClock+turns"
              }
            }
          ],
          "sid": 957034184567618
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "newdebugger",
              "sid": 694721634493413,
              "parameters": {
                "text": "\"ApplyPartyBuff_ATK\" & \", amt=\" & amt & \", after=\" & PartyBuff_ATK & \", cap=\" & PartyBuffCap_ATK"
              }
            },
            {
              "callFunction": "RegisterPartyBuffSlot",
              "sid": 250181319682661,
              "parameters": [
                "1"
              ]
            },
            {
              "callFunction": "HideAttackUI",
              "sid": 994958205708985
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 802217737735020
            }
          ],
          "sid": 629072682145023
        }
      ]
    },
    {
      "functionName": "Party_MAG_UP",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "turns",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 276819765125017
        },
        {
          "name": "addAmt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 719004738936251
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 586626846482115,
      "children": [
        {
          "eventType": "variable",
          "name": "amt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 248824277993605
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 130669819093167,
              "parameters": {
                "variable": "amt",
                "value": "int(addAmt)"
              }
            }
          ],
          "sid": 748105388695974
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 292198228243484,
              "parameters": {
                "variable": "PartyBuff_MAG",
                "value": "min(PartyBuffCap_MAG, PartyBuff_MAG+amt)"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 837982127861502,
              "parameters": {
                "variable": "BuffApplyClock",
                "value": "1"
              }
            }
          ],
          "sid": 844710138017407
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 461224131971771,
              "parameters": {
                "variable": "BuffExpire_MAG",
                "value": "HeroTurnClock+turns"
              }
            }
          ],
          "sid": 895938292322548
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "newdebugger",
              "sid": 203080259354787,
              "parameters": {
                "text": "\"ApplyPartyBuff_MAG\" & \", amt=\" & amt & \", after=\" & PartyBuff_MAG & \", cap=\" & PartyBuffCap_MAG"
              }
            },
            {
              "callFunction": "RegisterPartyBuffSlot",
              "sid": 578224970809112,
              "parameters": [
                "2"
              ]
            },
            {
              "callFunction": "HideAttackUI",
              "sid": 957459857648806
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 371908365197161
            }
          ],
          "sid": 491162642677311
        }
      ]
    },
    {
      "functionName": "Party_SPD_UP",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "turns",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 601016461825055
        },
        {
          "name": "addAmt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 116282304824231
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 511923210139919,
      "children": [
        {
          "eventType": "variable",
          "name": "amt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 452961580968545
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 899593202523970,
              "parameters": {
                "variable": "amt",
                "value": "int(addAmt)"
              }
            }
          ],
          "sid": 317034238786050
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 426058155910479,
              "parameters": {
                "variable": "PartyBuff_SPD",
                "value": "min(PartyBuffCap_SPD, PartyBuff_SPD+amt)"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 992632340160882,
              "parameters": {
                "variable": "BuffApplyClock",
                "value": "1"
              }
            }
          ],
          "sid": 557176934838955
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 851796659061655,
              "parameters": {
                "variable": "BuffExpire_SPD",
                "value": "HeroTurnClock+turns"
              }
            }
          ],
          "sid": 508594718043949
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "newdebugger",
              "sid": 824471153850926,
              "parameters": {
                "text": "\"ApplyPartyBuff_SPD\" & \", amt=\" & amt & \", after=\" & PartyBuff_SPD & \", cap=\" & PartyBuffCap_SPD"
              }
            },
            {
              "callFunction": "RegisterPartyBuffSlot",
              "sid": 871204027157893,
              "parameters": [
                "3"
              ]
            },
            {
              "callFunction": "HideAttackUI",
              "sid": 384083755781461
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 141567563914596
            }
          ],
          "sid": 214409363180114
        }
      ]
    },
    {
      "functionName": "Party_RES_UP",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "turns",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 492760823015450
        },
        {
          "name": "addAmt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 649769956961169
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 731795656827826,
      "children": [
        {
          "eventType": "variable",
          "name": "amt",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 712450955425614
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 506811952487071,
              "parameters": {
                "variable": "amt",
                "value": "int(addAmt)"
              }
            }
          ],
          "sid": 879608953750198
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 544190018835955,
              "parameters": {
                "variable": "PartyBuff_RES",
                "value": "min(PartyBuffCap_RES, PartyBuff_RES+amt)"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 581987155831155,
              "parameters": {
                "variable": "BuffApplyClock",
                "value": "1"
              }
            }
          ],
          "sid": 458529529875731
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 349673610362474,
              "parameters": {
                "variable": "BuffExpire_RES",
                "value": "HeroTurnClock+turns"
              }
            }
          ],
          "sid": 615761638552529
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "newdebugger",
              "sid": 593654803898264,
              "parameters": {
                "text": "\"ApplyPartyBuff_RES\" & \", amt=\" & amt & \", after=\" & PartyBuff_RES & \", cap=\" & PartyBuffCap_RES"
              }
            },
            {
              "callFunction": "RegisterPartyBuffSlot",
              "sid": 684023118951409,
              "parameters": [
                "4"
              ]
            },
            {
              "callFunction": "HideAttackUI",
              "sid": 308694118338193
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 731021577947301
            }
          ],
          "sid": 788446488734561
        }
      ]
    },
    {
      "functionName": "ApplyPartyHeal",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "healAmount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 587178376884538
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 356819806815277,
          "parameters": {
            "variable": "PartyHP",
            "value": "min(PartyMaxHP,PartyHP+healAmount)"
          }
        },
        {
          "callFunction": "SyncPartyHPToHeroes",
          "sid": 408027662257449
        },
        {
          "callFunction": "UpdateHeroHPUI",
          "sid": 448387512678903
        },
        {
          "callFunction": "UpdatePartyHPText",
          "sid": 425301403333263
        },
        {
          "callFunction": "UpdatePartyHPBar",
          "sid": 205512293589210
        }
      ],
      "sid": 634954006501747
    },
    {
      "functionName": "DoHeal",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "actorUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 473016341737295
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 701853695441647,
      "children": [
        {
          "eventType": "variable",
          "name": "healAmount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 107777261318203
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "HealSelf",
              "sid": 427723104917863,
              "parameters": [
                "actorUID",
                "0"
              ]
            }
          ],
          "sid": 385934536121549
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 125686285612918,
              "parameters": {
                "first-value": "ApplyChainToNextHeal",
                "comparison": 0,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 860985007386473,
              "parameters": {
                "variable": "healAmount",
                "value": "ceil(healAmount * ChainMultiplier)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 361440523232616,
              "parameters": {
                "variable": "ApplyChainToNextHeal",
                "value": "0"
              }
            }
          ],
          "sid": 154589387040535
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "ApplyPartyHeal",
              "sid": 194169540625375,
              "parameters": [
                "healAmount"
              ]
            }
          ],
          "sid": 386062753904940
        }
      ]
    }
  ],
  "sid": 206860066056657
};

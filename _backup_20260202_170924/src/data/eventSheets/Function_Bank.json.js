export const Function_Bank = {
  "name": "Function_Bank",
  "events": [
    {
      "functionName": "SlotX",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 735995091180871
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 665879778540441,
      "children": [
        {
          "eventType": "variable",
          "name": "offset",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 535778027226142
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 658688325464320,
              "parameters": {
                "variable": "i",
                "comparison": 0,
                "value": "floor(Slots/2)"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 260979445249484,
              "parameters": {
                "variable": "offset",
                "value": "-round(EnemySize / 2) "
              }
            }
          ],
          "sid": 614987701812917
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 443429164737358,
              "parameters": {
                "variable": "i",
                "comparison": 1,
                "value": "floor(Slots/2)"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 379544603125005,
              "parameters": {
                "variable": "offset",
                "value": "0"
              }
            }
          ],
          "sid": 507497396616240
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 182403917342904,
              "parameters": {
                "value": "X0+offset"
              }
            }
          ],
          "sid": 519620444475353
        }
      ]
    },
    {
      "functionName": "SlotY",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 791881556856998
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-function-return-value",
          "objectClass": "Functions",
          "sid": 587148224565003,
          "parameters": {
            "value": "EnemyAreaY0+i*Spacing"
          }
        }
      ],
      "sid": 246625053643226
    },
    {
      "eventType": "variable",
      "name": "WasSpawned",
      "type": "boolean",
      "initialValue": "false",
      "comment": "",
      "isStatic": false,
      "isConstant": false,
      "sid": 565127617825414
    },
    {
      "eventType": "variable",
      "name": "CurrentTurnIndex",
      "type": "number",
      "initialValue": "0",
      "comment": "",
      "isStatic": false,
      "isConstant": false,
      "sid": 664177122166307
    },
    {
      "eventType": "group",
      "disabled": false,
      "title": "Spawn Enemy",
      "description": "",
      "isActiveOnStart": true,
      "children": [
        {
          "functionName": "SpawnEnemy",
          "functionDescription": "",
          "functionCategory": "",
          "functionReturnType": "none",
          "functionCopyPicked": false,
          "functionIsAsync": false,
          "functionParameters": [
            {
              "name": "enemyName",
              "type": "string",
              "initialValue": "",
              "comment": "",
              "sid": 780586341910742
            },
            {
              "name": "slotIndex",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "sid": 774937498265417
            }
          ],
          "eventType": "function-block",
          "conditions": [],
          "actions": [
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 431644599273605,
              "parameters": {
                "variable": "WasSpawned",
                "value": "false"
              }
            }
          ],
          "sid": 758719521690413,
          "children": [
            {
              "eventType": "variable",
              "name": "hp",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 811047890413233
            },
            {
              "eventType": "variable",
              "name": "atk",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 331312177766818
            },
            {
              "eventType": "variable",
              "name": "def",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 175065846578983
            },
            {
              "eventType": "variable",
              "name": "mag",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 368391617859724
            },
            {
              "eventType": "variable",
              "name": "res",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 515620026286574
            },
            {
              "eventType": "variable",
              "name": "spd",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 764623822033520
            },
            {
              "eventType": "variable",
              "name": "rowFound",
              "type": "number",
              "initialValue": "-1",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 847947251424048
            },
            {
              "eventType": "variable",
              "name": "spawnSlot",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 350040549428021
            },
            {
              "eventType": "variable",
              "name": "found",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 795287444149320
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 346602817354625,
                  "parameters": {
                    "first-value": "EnemySlots.At(slotIndex,0,0)",
                    "comparison": 4,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [],
              "sid": 818858693364210,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "pick-by-unique-id",
                      "objectClass": "Enemy_Sprite",
                      "sid": 293427136570241,
                      "parameters": {
                        "unique-id": "EnemySlots.At(slotIndex,0,0)"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "destroy",
                      "objectClass": "Enemy_Sprite",
                      "sid": 640506755051232
                    },
                    {
                      "id": "set-at-xyz",
                      "objectClass": "EnemySlots",
                      "sid": 104276237737003,
                      "parameters": {
                        "x": "slotIndex",
                        "y": "0",
                        "z": "0",
                        "value": "-1"
                      }
                    }
                  ],
                  "sid": 453139345064183
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 603044307234625,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "1",
                    "end-index": "EnemyArray.Height-1"
                  }
                }
              ],
              "actions": [],
              "sid": 835044951869536,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 398245913664138,
                      "parameters": {
                        "first-value": "EnemyArray.At(0,loopindex(\"i\"),0)",
                        "comparison": 0,
                        "second-value": "enemyName"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 332784857590918,
                      "parameters": {
                        "variable": "rowFound",
                        "value": "loopindex(\"i\")"
                      }
                    },
                    {
                      "id": "stop-loop",
                      "objectClass": "System",
                      "sid": 589250532081883
                    }
                  ],
                  "sid": 626778849280730
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 899352421908748,
                  "parameters": {
                    "first-value": "rowFound",
                    "comparison": 1,
                    "second-value": "-1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 534985937676795,
                  "parameters": {
                    "variable": "hp",
                    "value": "int(EnemyArray.At(1,rowFound,0))"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 632544487141874,
                  "parameters": {
                    "variable": "atk",
                    "value": "int(EnemyArray.At(2,rowFound,0))"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 114251817200837,
                  "parameters": {
                    "variable": "def",
                    "value": "int(EnemyArray.At(3,rowFound,0))"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 386925234072634,
                  "parameters": {
                    "variable": "mag",
                    "value": "int(EnemyArray.At(4,rowFound,0))"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 263794512524917,
                  "parameters": {
                    "variable": "res",
                    "value": "int(EnemyArray.At(5,rowFound,0))"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 736847205262030,
                  "parameters": {
                    "variable": "spd",
                    "value": "int(EnemyArray.At(6,rowFound,0))"
                  }
                },
                {
                  "id": "set-text",
                  "objectClass": "ActorIntent",
                  "sid": 280160323396895,
                  "parameters": {
                    "text": "\"SPAWN: slot=\" & slotIndex & \" enemy=\" & enemyName & \" rowFound=\" & rowFound & \" HP=\" & hp & \"\""
                  }
                }
              ],
              "sid": 456014518627798,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 624702818010429,
                      "parameters": {
                        "first-value": "hp",
                        "comparison": 4,
                        "second-value": "0"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "create-object",
                      "objectClass": "System",
                      "sid": 280656817659122,
                      "parameters": {
                        "object-to-create": "Enemy_Sprite",
                        "layer": "\"Enemies\"",
                        "x": "Functions.SlotX(slotIndex)",
                        "y": "Functions.SlotY(slotIndex)",
                        "create-hierarchy": true,
                        "template-name": "\"\""
                      }
                    },
                    {
                      "id": "set-z-elevation",
                      "objectClass": "Enemy_Sprite",
                      "sid": 617572390593505,
                      "parameters": {
                        "z": "0"
                      }
                    },
                    {
                      "id": "set-animation",
                      "objectClass": "Enemy_Sprite",
                      "sid": 666905936725101,
                      "parameters": {
                        "animation": "enemyName",
                        "from": "beginning"
                      }
                    },
                    {
                      "id": "set-animation-frame",
                      "objectClass": "Enemy_Sprite",
                      "sid": 729011403160157,
                      "parameters": {
                        "frame-number": "0"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 307627783631247,
                      "parameters": {
                        "instance-variable": "origW",
                        "value": "Enemy_Sprite.Width"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 221549550901512,
                      "parameters": {
                        "instance-variable": "origH",
                        "value": "Enemy_Sprite.Height"
                      }
                    },
                    {
                      "id": "set-height",
                      "objectClass": "Enemy_Sprite",
                      "sid": 244287382085425,
                      "parameters": {
                        "height": "EnemySize"
                      }
                    },
                    {
                      "id": "set-width",
                      "objectClass": "Enemy_Sprite",
                      "sid": 201938588312828,
                      "parameters": {
                        "width": "round(EnemySize * (Enemy_Sprite.origW / Enemy_Sprite.origH))"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 993080368858090,
                      "parameters": {
                        "instance-variable": "slotIndex",
                        "value": "slotIndex"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 246796811969643,
                      "parameters": {
                        "instance-variable": "name",
                        "value": "enemyName"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 860856007414226,
                      "parameters": {
                        "instance-variable": "HP",
                        "value": "hp"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 921015006788334,
                      "parameters": {
                        "instance-variable": "ATK",
                        "value": "atk"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 919970588029276,
                      "parameters": {
                        "instance-variable": "DEF",
                        "value": "def"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 588225223576484,
                      "parameters": {
                        "instance-variable": "MAG",
                        "value": "mag"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 332495481654305,
                      "parameters": {
                        "instance-variable": "RES",
                        "value": "res"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 922055006993178,
                      "parameters": {
                        "instance-variable": "SPD",
                        "value": "spd"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 486248239727004,
                      "parameters": {
                        "instance-variable": "maxHP",
                        "value": "hp"
                      }
                    },
                    {
                      "id": "set-at-xyz",
                      "objectClass": "EnemySlots",
                      "sid": 861848888190003,
                      "parameters": {
                        "x": "slotIndex",
                        "y": "0",
                        "z": "0",
                        "value": "Enemy_Sprite.UID+1"
                      }
                    },
                    {
                      "id": "set-visible",
                      "objectClass": "Enemy_Sprite",
                      "sid": 520201137207183,
                      "parameters": {
                        "visibility": "visible"
                      }
                    },
                    {
                      "id": "set-boolean-eventvar",
                      "objectClass": "System",
                      "sid": 495120626681442,
                      "parameters": {
                        "variable": "WasSpawned",
                        "value": "true"
                      }
                    },
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 177857436339102,
                      "parameters": {
                        "instance-variable": "AttackTimerReset",
                        "value": "max(5, round(3 + 0.036 * Enemy_Sprite.maxHP))"
                      }
                    },
                    {
                      "id": "set-text",
                      "objectClass": "ActorIntent",
                      "sid": 777166545333802,
                      "parameters": {
                        "text": "\"\\nUID=\" & Enemy_Sprite.UID &\n                  \" storedSlot=\" & EnemySlots.At(slotIndex,0,0) &\n                  \" realUID=\" & (EnemySlots.At(slotIndex,0,0)-1)"
                      }
                    }
                  ],
                  "sid": 358645676733148,
                  "children": [
                    {
                      "eventType": "block",
                      "conditions": [
                        {
                          "id": "pick-children",
                          "objectClass": "Enemy_Sprite",
                          "sid": 444462885459477,
                          "parameters": {
                            "child": "Bar_Fill",
                            "which": "own"
                          }
                        }
                      ],
                      "actions": [],
                      "sid": 450953199922772,
                      "children": [
                        {
                          "eventType": "block",
                          "conditions": [],
                          "actions": [
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Bar_Fill",
                              "sid": 622182100900834,
                              "parameters": {
                                "instance-variable": "ownerID",
                                "value": "Enemy_Sprite.UID"
                              }
                            },
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Bar_Fill",
                              "sid": 663445467204386,
                              "parameters": {
                                "instance-variable": "showUtil",
                                "value": "0"
                              }
                            }
                          ],
                          "sid": 574778250946546,
                          "children": [
                            {
                              "eventType": "block",
                              "conditions": [
                                {
                                  "id": "compare-two-values",
                                  "objectClass": "System",
                                  "sid": 506731894808102,
                                  "parameters": {
                                    "first-value": "Bar_Fill.baseW",
                                    "comparison": 0,
                                    "second-value": "0"
                                  }
                                }
                              ],
                              "actions": [
                                {
                                  "id": "set-instvar-value",
                                  "objectClass": "Bar_Fill",
                                  "sid": 815193134227116,
                                  "parameters": {
                                    "instance-variable": "baseW",
                                    "value": "Bar_Fill.Width"
                                  }
                                },
                                {
                                  "id": "set-width",
                                  "objectClass": "Bar_Fill",
                                  "sid": 799954560338070,
                                  "parameters": {
                                    "width": "Bar_Fill.baseW"
                                  }
                                },
                                {
                                  "id": "set-instvar-value",
                                  "objectClass": "Bar_Fill",
                                  "sid": 315130427076681,
                                  "parameters": {
                                    "instance-variable": "targetWidth",
                                    "value": "Bar_Fill.baseW"
                                  }
                                },
                                {
                                  "id": "set-visible",
                                  "objectClass": "Bar_Fill",
                                  "sid": 883486994680246,
                                  "parameters": {
                                    "visibility": "visible"
                                  }
                                }
                              ],
                              "sid": 779823703031502
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "eventType": "block",
                      "conditions": [
                        {
                          "id": "pick-children",
                          "objectClass": "Enemy_Sprite",
                          "sid": 982184979643857,
                          "parameters": {
                            "child": "Bar_Yellow",
                            "which": "own"
                          }
                        }
                      ],
                      "actions": [],
                      "sid": 149236560442093,
                      "children": [
                        {
                          "eventType": "block",
                          "conditions": [],
                          "actions": [
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Bar_Yellow",
                              "sid": 156131247867270,
                              "parameters": {
                                "instance-variable": "ownerID",
                                "value": "Enemy_Sprite.UID"
                              }
                            },
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Bar_Yellow",
                              "sid": 485691839266509,
                              "parameters": {
                                "instance-variable": "showUtil",
                                "value": "0"
                              }
                            }
                          ],
                          "sid": 842100918087234,
                          "children": [
                            {
                              "eventType": "block",
                              "conditions": [
                                {
                                  "id": "compare-two-values",
                                  "objectClass": "System",
                                  "sid": 776954542292384,
                                  "parameters": {
                                    "first-value": "Bar_Yellow.baseW",
                                    "comparison": 0,
                                    "second-value": "0"
                                  }
                                }
                              ],
                              "actions": [
                                {
                                  "id": "set-instvar-value",
                                  "objectClass": "Bar_Yellow",
                                  "sid": 136492630914509,
                                  "parameters": {
                                    "instance-variable": "baseW",
                                    "value": "Bar_Yellow.Width"
                                  }
                                },
                                {
                                  "id": "set-width",
                                  "objectClass": "Bar_Yellow",
                                  "sid": 474192736034007,
                                  "parameters": {
                                    "width": "Bar_Yellow.baseW"
                                  }
                                },
                                {
                                  "id": "set-instvar-value",
                                  "objectClass": "Bar_Yellow",
                                  "sid": 994878636389585,
                                  "parameters": {
                                    "instance-variable": "targetWidth",
                                    "value": "Bar_Yellow.baseW"
                                  }
                                },
                                {
                                  "id": "set-visible",
                                  "objectClass": "Bar_Yellow",
                                  "sid": 333380606587160,
                                  "parameters": {
                                    "visibility": "visible"
                                  }
                                }
                              ],
                              "sid": 714903109801652
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "eventType": "block",
                      "conditions": [
                        {
                          "id": "pick-children",
                          "objectClass": "Enemy_Sprite",
                          "sid": 661777610520458,
                          "parameters": {
                            "child": "Bar_Back",
                            "which": "own"
                          }
                        }
                      ],
                      "actions": [],
                      "sid": 140111093048949,
                      "children": [
                        {
                          "eventType": "block",
                          "conditions": [],
                          "actions": [
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Bar_Back",
                              "sid": 903817421405803,
                              "parameters": {
                                "instance-variable": "ownerID",
                                "value": "Enemy_Sprite.UID"
                              }
                            },
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Bar_Back",
                              "sid": 433284281495414,
                              "parameters": {
                                "instance-variable": "showUtil",
                                "value": "0"
                              }
                            },
                            {
                              "id": "set-visible",
                              "objectClass": "Bar_Back",
                              "sid": 379855604860706,
                              "parameters": {
                                "visibility": "visible"
                              }
                            }
                          ],
                          "sid": 941462304177749
                        }
                      ]
                    },
                    {
                      "eventType": "block",
                      "conditions": [],
                      "actions": [
                        {
                          "callFunction": "Update_Bars",
                          "sid": 247686913897134
                        }
                      ],
                      "sid": 272963429663777
                    }
                  ]
                },
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "else",
                      "objectClass": "System",
                      "sid": 559210504771734
                    }
                  ],
                  "actions": [],
                  "sid": 614427432665733
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 162999025389063,
                  "parameters": {
                    "first-value": "rowFound",
                    "comparison": 0,
                    "second-value": "-1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-boolean-eventvar",
                  "objectClass": "System",
                  "sid": 698555285186524,
                  "parameters": {
                    "variable": "WasSpawned",
                    "value": "false"
                  }
                }
              ],
              "sid": 385096063656130
            }
          ]
        }
      ],
      "sid": 214493018092894,
      "text-color": [
        0.26666666666666666,
        0.011764705882352941,
        0.011764705882352941,
        1
      ],
      "background-color": [
        0.9607843137254902,
        0.7411764705882353,
        0.5411764705882353,
        1
      ]
    },
    {
      "functionName": "PickNextEnemyID",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "string",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 561533307861530,
      "children": [
        {
          "eventType": "variable",
          "name": "idx",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 236428432963558
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 560193361128415,
              "parameters": {
                "variable": "idx",
                "value": "floor(random(1,EnemyArray.Height))"
              }
            }
          ],
          "sid": 533843252638294,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 385312962597310,
                  "parameters": {
                    "first-value": "EnemyArray.Height",
                    "comparison": 4,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [],
              "sid": 677214966937736,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-at-xyz",
                      "objectClass": "EnemyArray",
                      "sid": 911200305511410,
                      "parameters": {
                        "x": "0",
                        "y": "idx",
                        "z": "0",
                        "comparison": 1,
                        "value": "\"\""
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-function-return-value",
                      "objectClass": "Functions",
                      "sid": 344440630752949,
                      "parameters": {
                        "value": "EnemyArray.At(0, idx, 0)"
                      }
                    }
                  ],
                  "sid": 523770196535340
                },
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-at-xyz",
                      "objectClass": "EnemyArray",
                      "sid": 431291050587084,
                      "parameters": {
                        "x": "0",
                        "y": "idx",
                        "z": "0",
                        "comparison": 0,
                        "value": "\"\""
                      }
                    }
                  ],
                  "actions": [],
                  "sid": 737441364162897,
                  "children": [
                    {
                      "eventType": "block",
                      "conditions": [
                        {
                          "id": "for",
                          "objectClass": "System",
                          "sid": 504968785098299,
                          "parameters": {
                            "name": "\"i\"",
                            "start-index": "1",
                            "end-index": "EnemyArray.Height-1"
                          }
                        }
                      ],
                      "actions": [],
                      "sid": 569183200701475,
                      "children": [
                        {
                          "eventType": "block",
                          "conditions": [
                            {
                              "id": "compare-at-xyz",
                              "objectClass": "EnemyArray",
                              "sid": 426035410581862,
                              "parameters": {
                                "x": "0",
                                "y": "loopindex(\"i\")",
                                "z": "0",
                                "comparison": 1,
                                "value": "\"\""
                              }
                            }
                          ],
                          "actions": [
                            {
                              "id": "set-function-return-value",
                              "objectClass": "Functions",
                              "sid": 224676352134925,
                              "parameters": {
                                "value": "EnemyArray.At(0,loopindex(\"i\"),0)"
                              }
                            },
                            {
                              "id": "stop-loop",
                              "objectClass": "System",
                              "sid": 997869669599702
                            }
                          ],
                          "sid": 876866993789820
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 676286513266741,
                  "parameters": {
                    "first-value": "EnemyArray.Height",
                    "comparison": 3,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-function-return-value",
                  "objectClass": "Functions",
                  "sid": 815585879873244,
                  "parameters": {
                    "value": "\"\""
                  }
                }
              ],
              "sid": 227629700893666
            }
          ]
        }
      ]
    },
    {
      "functionName": "KillEnemyAt",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "slotIndex",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 904200678950694
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 903517368267555,
      "children": [
        {
          "eventType": "variable",
          "name": "deadCell",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 808639457082157
        },
        {
          "eventType": "variable",
          "name": "deadUID",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 746522899645805
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 398534621576250,
              "parameters": {
                "variable": "deadCell",
                "value": "EnemySlots.At(slotIndex, 0, 0)"
              }
            }
          ],
          "sid": 955040156267871
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 334721313451564,
              "parameters": {
                "first-value": "deadCell",
                "comparison": 3,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 474064947417759
            }
          ],
          "sid": 606828806687745
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 870652424128592,
              "parameters": {
                "first-value": "deadCell",
                "comparison": 4,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 813029835398457,
              "parameters": {
                "variable": "deadUID",
                "value": "deadCell-1"
              }
            }
          ],
          "sid": 929604890645782,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Enemy_Sprite",
                  "sid": 862100271867648,
                  "parameters": {
                    "unique-id": "deadUID"
                  }
                }
              ],
              "actions": [
                {
                  "id": "destroy",
                  "objectClass": "Enemy_Sprite",
                  "sid": 985769487109287
                }
              ],
              "sid": 687478934225705
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-at-xyz",
              "objectClass": "EnemySlots",
              "sid": 274049504677177,
              "parameters": {
                "x": "slotIndex",
                "y": "0",
                "z": "0",
                "value": "0"
              }
            }
          ],
          "sid": 685874259185746
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "wait",
              "objectClass": "System",
              "sid": 477617152141550,
              "parameters": {
                "seconds": ".40",
                "use-timescale": true
              }
            },
            {
              "callFunction": "SpawnEnemy",
              "sid": 308828164385680,
              "parameters": [
                "Functions.PickNextEnemyID",
                "slotIndex"
              ]
            },
            {
              "callFunction": "Update_Bars",
              "sid": 244093071219750
            },
            {
              "callFunction": "BuildTurnOrder",
              "sid": 917237274621241
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 813140407010187,
              "parameters": {
                "variable": "IsPlayerBusy",
                "value": "0"
              }
            }
          ],
          "sid": 717640457662491
        }
      ]
    },
    {
      "functionName": "ShowAttackUI",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 262463594915109,
          "parameters": {
            "variable": "CanPickGems",
            "value": "false"
          }
        },
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 611040758022476,
          "parameters": {
            "variable": "IsPlayerBusy",
            "value": "1"
          }
        },
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 693312114306529,
          "parameters": {
            "variable": "SuppressChainUI",
            "value": "false"
          }
        },
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 359967633604544,
          "parameters": {
            "variable": "TurnPhase",
            "value": "1"
          }
        },
        {
          "callFunction": "HideAttackUI",
          "sid": 529790716927032
        }
      ],
      "sid": 803252683219877,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-all",
              "objectClass": "System",
              "sid": 768083391189747,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            }
          ],
          "actions": [
            {
              "id": "set-instvar-value",
              "objectClass": "Enemy_Sprite",
              "sid": 551924874647945,
              "parameters": {
                "instance-variable": "IsSelected",
                "value": "0"
              }
            }
          ],
          "sid": 813229954370485
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 218414954261396,
              "parameters": {
                "first-value": "IsAOEMatch",
                "comparison": 0,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 842362863344116,
              "parameters": {
                "variable": "ShowAllEnemyBars",
                "value": "true"
              }
            },
            {
              "callFunction": "RefreshSelectors",
              "sid": 549846696529787
            },
            {
              "id": "create-object",
              "objectClass": "System",
              "sid": 845847512094810,
              "parameters": {
                "object-to-create": "AttackButton",
                "layer": "\"Attack_UI\"",
                "x": "180",
                "y": "235",
                "create-hierarchy": false,
                "template-name": "\"\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 590560457332044,
              "parameters": {
                "variable": "IsPlayerBusy",
                "value": "0"
              }
            }
          ],
          "sid": 643867662760666
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "else",
              "objectClass": "System",
              "sid": 474161712861801
            }
          ],
          "actions": [
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 823271155088134,
              "parameters": {
                "variable": "ShowAllEnemyBars",
                "value": "false"
              }
            }
          ],
          "sid": 266015828578784
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 585222278042314,
              "parameters": {
                "first-value": "IsAOEMatch",
                "comparison": 0,
                "second-value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 800335933814542,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-all",
                  "objectClass": "System",
                  "sid": 117085212303848,
                  "parameters": {
                    "object": "Enemy_Sprite"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-instvar-value",
                  "objectClass": "Enemy_Sprite",
                  "sid": 796426327430786,
                  "parameters": {
                    "instance-variable": "IsSelected",
                    "value": "0"
                  }
                }
              ],
              "sid": 404878255600891
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 896048311758937,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "0",
                    "end-index": "Slots-1"
                  }
                }
              ],
              "actions": [],
              "sid": 186964491188786,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 763845289399864,
                      "parameters": {
                        "first-value": "EnemySlots.At(loopindex(\"i\"),0,0)",
                        "comparison": 4,
                        "second-value": "0"
                      }
                    },
                    {
                      "id": "pick-by-unique-id",
                      "objectClass": "Enemy_Sprite",
                      "sid": 389523153902568,
                      "parameters": {
                        "unique-id": "EnemySlots.At(loopindex(\"i\"),0,0)-1"
                      }
                    },
                    {
                      "id": "compare-instance-variable",
                      "objectClass": "Enemy_Sprite",
                      "sid": 876063003568680,
                      "parameters": {
                        "instance-variable": "HP",
                        "comparison": 4,
                        "value": "0"
                      }
                    }
                  ],
                  "actions": [],
                  "sid": 782315879226837,
                  "children": [
                    {
                      "eventType": "block",
                      "conditions": [],
                      "actions": [
                        {
                          "id": "set-instvar-value",
                          "objectClass": "Enemy_Sprite",
                          "sid": 520762321775471,
                          "parameters": {
                            "instance-variable": "IsSelected",
                            "value": "1"
                          }
                        },
                        {
                          "id": "stop-loop",
                          "objectClass": "System",
                          "sid": 548829630368234
                        }
                      ],
                      "sid": 406741468738948
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "RefreshSelectors",
              "sid": 144178405702709
            }
          ],
          "sid": 473888880719786
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "create-object",
              "objectClass": "System",
              "sid": 790830616714838,
              "parameters": {
                "object-to-create": "AttackButton",
                "layer": "\"Attack_UI\"",
                "x": "180",
                "y": "235",
                "create-hierarchy": false,
                "template-name": "\"\""
              }
            }
          ],
          "sid": 548945860228273
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 774315993594255,
              "parameters": {
                "variable": "IsPlayerBusy",
                "value": "0"
              }
            }
          ],
          "sid": 647325613205690
        }
      ]
    },
    {
      "functionName": "HideAttackUI",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 477912534579003,
          "parameters": {
            "variable": "ShowAllEnemyBars",
            "value": "false"
          }
        },
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 134853446594679,
          "parameters": {
            "variable": "CanPickGems",
            "value": "true"
          }
        },
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 568954853038782,
          "parameters": {
            "variable": "IsPlayerBusy",
            "value": "0"
          }
        },
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 191638408035905,
          "parameters": {
            "variable": "SuppressChainUI",
            "value": "false"
          }
        },
        {
          "id": "destroy",
          "objectClass": "Selector",
          "sid": 682742503552667
        },
        {
          "id": "destroy",
          "objectClass": "AttackButton",
          "sid": 683598130470209
        }
      ],
      "sid": 412304015107863
    },
    {
      "functionName": "MeleeCalc",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "attackerUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 583978286594241
        },
        {
          "name": "defenderUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 100968965788773
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 523503686414038,
      "children": [
        {
          "eventType": "variable",
          "name": "atk",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 836974361051610
        },
        {
          "eventType": "variable",
          "name": "def",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 755185745438835
        },
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 186759764508213
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 600565921816242,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 859569552048304,
              "parameters": {
                "variable": "atk",
                "value": "Heroes.ATK"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 741249137461843,
              "parameters": {
                "variable": "atk",
                "value": "PartyBuff_ATK"
              }
            }
          ],
          "sid": 122883021506891
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 437312346076934,
              "parameters": {
                "unique-id": "defenderUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 500987701429823,
              "parameters": {
                "variable": "def",
                "value": "Enemy_Sprite.DEF"
              }
            }
          ],
          "sid": 226573828722659
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 810283089588468,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 823735981785758,
              "parameters": {
                "variable": "atk",
                "value": "Enemy_Sprite.ATK"
              }
            }
          ],
          "sid": 247162042025637
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 871048287510643,
              "parameters": {
                "unique-id": "defenderUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 379234105876262,
              "parameters": {
                "variable": "def",
                "value": "Heroes.DEF"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 353009584048135,
              "parameters": {
                "variable": "def",
                "value": "PartyBuff_DEF"
              }
            }
          ],
          "sid": 271528814838906
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 642520766110253,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [],
          "sid": 825430022087340,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 765957532934161,
                  "parameters": {
                    "first-value": "IsAOEMatch",
                    "comparison": 0,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 585086635403281,
                  "parameters": {
                    "variable": "damage",
                    "value": "ceil(((atk - (def * 0.35)) * random(0.8, 1.2)))"
                  }
                }
              ],
              "sid": 194127730413839
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 255183415013404,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [],
          "sid": 608991962451122,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 747507709147945,
                  "parameters": {
                    "first-value": "IsAOEMatch",
                    "comparison": 0,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 203641870300416,
                  "parameters": {
                    "variable": "damage",
                    "value": "ceil((atk - def/2) * random(0.8, 1.2))"
                  }
                }
              ],
              "sid": 139188008438146
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 679903972360582,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 488031132103836,
              "parameters": {
                "variable": "damage",
                "value": "ceil((atk - def/2) * random(0.8, 1.2))"
              }
            }
          ],
          "sid": 567713100246178
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 635146290287810,
              "parameters": {
                "variable": "damage",
                "value": "max(1,damage)"
              }
            }
          ],
          "sid": 121007016618658
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 907309953998775,
              "parameters": {
                "value": "damage"
              }
            }
          ],
          "sid": 985825025114678
        }
      ]
    },
    {
      "functionName": "MagicCalc",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "attackerUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 985516895699938
        },
        {
          "name": "defenderUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 143251693216020
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 941063817852396,
      "children": [
        {
          "eventType": "variable",
          "name": "mag",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 988373357763740
        },
        {
          "eventType": "variable",
          "name": "res",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 984814626119809
        },
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 112882539613107
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 624010518644680,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 350714098122048,
              "parameters": {
                "variable": "mag",
                "value": "Heroes.MAG"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 228940090040868,
              "parameters": {
                "variable": "mag",
                "value": "PartyBuff_MAG"
              }
            }
          ],
          "sid": 440913796715618
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 366439183631912,
              "parameters": {
                "unique-id": "defenderUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 560281863278262,
              "parameters": {
                "variable": "res",
                "value": "Enemy_Sprite.RES"
              }
            }
          ],
          "sid": 784793310629895
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 583894731929160,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 496276615780438,
              "parameters": {
                "variable": "mag",
                "value": "Enemy_Sprite.MAG"
              }
            }
          ],
          "sid": 167570078387113
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 213687217186981,
              "parameters": {
                "unique-id": "defenderUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 154999246591791,
              "parameters": {
                "variable": "res",
                "value": "Heroes.RES"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 946351719343882,
              "parameters": {
                "variable": "res",
                "value": "PartyBuff_RES"
              }
            }
          ],
          "sid": 460962159203916
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 618360566853615,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [],
          "sid": 209932155417809,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 747393983643625,
                  "parameters": {
                    "first-value": "IsAOEMatch",
                    "comparison": 0,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 460142013555749,
                  "parameters": {
                    "variable": "damage",
                    "value": "ceil(((mag - (res * 0.35)) * random(0.8, 1.2)))"
                  }
                }
              ],
              "sid": 581876758308285
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 563391219331564,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [],
          "sid": 905025066879369,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 134222384774769,
                  "parameters": {
                    "first-value": "IsAOEMatch",
                    "comparison": 0,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 371720069453322,
                  "parameters": {
                    "variable": "damage",
                    "value": "ceil((mag - res/2) * random(0.8, 1.2))"
                  }
                }
              ],
              "sid": 183578356228748
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 441004924049050,
              "parameters": {
                "unique-id": "attackerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 293736685094136,
              "parameters": {
                "variable": "damage",
                "value": "ceil((mag - res/2) * random(0.8, 1.2))"
              }
            }
          ],
          "sid": 833048167699115
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 473916018533448,
              "parameters": {
                "variable": "damage",
                "value": "max(1,damage)"
              }
            }
          ],
          "sid": 624489991675158
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 314065797776024,
              "parameters": {
                "value": "damage"
              }
            }
          ],
          "sid": 413890139928587
        }
      ]
    },
    {
      "functionName": "Add_Energy",
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
          "sid": 885598786882077
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 984271924079621,
      "children": [
        {
          "eventType": "variable",
          "name": "gained",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 601627024267433
        },
        {
          "eventType": "variable",
          "name": "heroUID",
          "type": "number",
          "initialValue": "1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 987849748408493
        },
        {
          "eventType": "variable",
          "name": "actorName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 897922904793147
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 991079811380106,
              "parameters": {
                "variable": "heroUID",
                "value": "Functions.GetCurrentTurn"
              }
            }
          ],
          "sid": 263673812799830
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 903436226074458,
              "parameters": {
                "unique-id": "heroUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 336198463869807,
              "parameters": {
                "variable": "actorName",
                "value": "Heroes.name"
              }
            }
          ],
          "sid": 159556068934212
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 264666691971749,
              "parameters": {
                "variable": "gained",
                "value": "int(random(6,9,12,15,27))"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 873856616749481,
              "parameters": {
                "variable": "Player_Energy",
                "value": "gained"
              }
            },
            {
              "id": "set-text",
              "objectClass": "Text_Energy",
              "sid": 711385913978246,
              "parameters": {
                "text": "Player_Energy & \"n\""
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 623902482624301,
              "parameters": [
                "actorName & \" grabbed \" & gained & \" magic orbs!\""
              ]
            }
          ],
          "sid": 701316095106987
        }
      ]
    },
    {
      "functionName": "Add_Gold",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "amount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 688630689560602
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 733235585672157,
          "parameters": {
            "variable": "amount",
            "value": "int(random(1,8))"
          }
        }
      ],
      "sid": 154300266384612,
      "children": [
        {
          "eventType": "variable",
          "name": "finalAmount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 154640592860587
        },
        {
          "eventType": "variable",
          "name": "actorName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 232216106883315
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 916585602488742,
              "parameters": {
                "variable": "finalAmount",
                "value": "int(amount)"
              }
            }
          ],
          "sid": 236141794095308
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 701897500339677,
              "parameters": {
                "unique-id": "Functions.GetCurrentTurn"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 803204126255491,
              "parameters": {
                "variable": "actorName",
                "value": "Heroes.name"
              }
            }
          ],
          "sid": 837237995258460
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 681773812948127,
              "parameters": {
                "variable": "goldTotal",
                "value": "finalAmount"
              }
            },
            {
              "id": "set-text",
              "objectClass": "Text_Gold",
              "sid": 434315287144317,
              "parameters": {
                "text": "goldTotal & \"g\""
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 118350142256394,
              "parameters": [
                "actorName & \" found \" & finalAmount & \" gold!\""
              ]
            }
          ],
          "sid": 636783861419519
        }
      ]
    },
    {
      "eventType": "group",
      "disabled": false,
      "title": "REFILL GEMS",
      "description": "",
      "isActiveOnStart": true,
      "children": [
        {
          "functionName": "DoRefillStep",
          "functionDescription": "",
          "functionCategory": "",
          "functionReturnType": "none",
          "functionCopyPicked": false,
          "functionIsAsync": false,
          "functionParameters": [
            {
              "name": "step",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "sid": 993650411265400
            }
          ],
          "eventType": "function-block",
          "conditions": [],
          "actions": [],
          "sid": 390440311649672,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 587989306839268,
                  "parameters": {
                    "first-value": "step",
                    "comparison": 2,
                    "second-value": "GemRefillArray.Width/2"
                  }
                }
              ],
              "actions": [],
              "sid": 433275054206582,
              "children": [
                {
                  "eventType": "variable",
                  "name": "c",
                  "type": "number",
                  "initialValue": "0",
                  "comment": "",
                  "isStatic": false,
                  "isConstant": false,
                  "sid": 880020400598060
                },
                {
                  "eventType": "variable",
                  "name": "r",
                  "type": "number",
                  "initialValue": "0",
                  "comment": "",
                  "isStatic": false,
                  "isConstant": false,
                  "sid": 214523058163754
                },
                {
                  "eventType": "variable",
                  "name": "x",
                  "type": "number",
                  "initialValue": "0",
                  "comment": "",
                  "isStatic": false,
                  "isConstant": false,
                  "sid": 633851743180922
                },
                {
                  "eventType": "block",
                  "conditions": [],
                  "actions": [
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 764825544857949,
                      "parameters": {
                        "variable": "c",
                        "value": "GemRefillArray.At(step*2)"
                      }
                    },
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 371306758084745,
                      "parameters": {
                        "variable": "r",
                        "value": "GemRefillArray.At(step*2+1)"
                      }
                    }
                  ],
                  "sid": 320396045244131,
                  "children": [
                    {
                      "eventType": "block",
                      "conditions": [
                        {
                          "id": "compare-two-values",
                          "objectClass": "System",
                          "sid": 667879559177117,
                          "parameters": {
                            "first-value": "Grid.At(c,r,0)",
                            "comparison": 0,
                            "second-value": "0"
                          }
                        }
                      ],
                      "actions": [
                        {
                          "id": "create-object",
                          "objectClass": "System",
                          "sid": 993208322172122,
                          "parameters": {
                            "object-to-create": "Gem",
                            "layer": "\"Game\"",
                            "x": "gx + c * (cellSize+gap) + cellSize/2",
                            "y": "gy + r * (cellSize + gap) + cellSize/2",
                            "create-hierarchy": false,
                            "template-name": "\"\""
                          }
                        },
                        {
                          "id": "set-instvar-value",
                          "objectClass": "Gem",
                          "sid": 800616835376936,
                          "parameters": {
                            "instance-variable": "cellC",
                            "value": "c"
                          }
                        },
                        {
                          "id": "set-instvar-value",
                          "objectClass": "Gem",
                          "sid": 752401636101494,
                          "parameters": {
                            "instance-variable": "cellR",
                            "value": "r"
                          }
                        },
                        {
                          "id": "set-size",
                          "objectClass": "Gem",
                          "sid": 816544813288720,
                          "parameters": {
                            "width": "cellSize",
                            "height": "cellSize"
                          }
                        }
                      ],
                      "sid": 248681814409210,
                      "children": [
                        {
                          "eventType": "block",
                          "conditions": [],
                          "actions": [
                            {
                              "id": "set-eventvar-value",
                              "objectClass": "System",
                              "sid": 771336288384841,
                              "parameters": {
                                "variable": "x",
                                "value": "int(random(1000))"
                              }
                            }
                          ],
                          "sid": 940745720139633,
                          "children": [
                            {
                              "eventType": "block",
                              "conditions": [
                                {
                                  "id": "compare-eventvar",
                                  "objectClass": "System",
                                  "sid": 452731443875985,
                                  "parameters": {
                                    "variable": "x",
                                    "comparison": 2,
                                    "value": "998"
                                  }
                                }
                              ],
                              "actions": [
                                {
                                  "id": "set-animation-frame",
                                  "objectClass": "Gem",
                                  "sid": 978250228660617,
                                  "parameters": {
                                    "frame-number": "int(random(6))"
                                  }
                                }
                              ],
                              "sid": 292457820060150
                            },
                            {
                              "eventType": "block",
                              "conditions": [
                                {
                                  "id": "compare-eventvar",
                                  "objectClass": "System",
                                  "sid": 239295001529673,
                                  "parameters": {
                                    "variable": "x",
                                    "comparison": 0,
                                    "value": "998"
                                  }
                                }
                              ],
                              "actions": [
                                {
                                  "id": "set-animation-frame",
                                  "objectClass": "Gem",
                                  "sid": 709322812411825,
                                  "parameters": {
                                    "frame-number": "6"
                                  }
                                }
                              ],
                              "sid": 495843503169159
                            },
                            {
                              "eventType": "block",
                              "conditions": [
                                {
                                  "id": "compare-eventvar",
                                  "objectClass": "System",
                                  "sid": 191083743095398,
                                  "parameters": {
                                    "variable": "x",
                                    "comparison": 0,
                                    "value": "999"
                                  }
                                }
                              ],
                              "actions": [
                                {
                                  "id": "set-animation-frame",
                                  "objectClass": "Gem",
                                  "sid": 765440924127838,
                                  "parameters": {
                                    "frame-number": "7"
                                  }
                                }
                              ],
                              "sid": 901991957163276
                            }
                          ]
                        },
                        {
                          "eventType": "block",
                          "conditions": [],
                          "actions": [
                            {
                              "id": "stop-animation",
                              "objectClass": "Gem",
                              "sid": 597099943199918
                            },
                            {
                              "id": "set-instvar-value",
                              "objectClass": "Gem",
                              "sid": 975039543976884,
                              "parameters": {
                                "instance-variable": "elementIndex",
                                "value": "Gem.AnimationFrame"
                              }
                            },
                            {
                              "id": "set-at-xyz",
                              "objectClass": "Grid",
                              "sid": 119259966099632,
                              "parameters": {
                                "x": "c",
                                "y": "r",
                                "z": "0",
                                "value": "Gem.UID"
                              }
                            }
                          ],
                          "sid": 406528070296196
                        }
                      ]
                    },
                    {
                      "eventType": "block",
                      "conditions": [],
                      "actions": [
                        {
                          "callFunction": "DoRefillStep",
                          "sid": 209840620115098,
                          "parameters": [
                            "step+1"
                          ]
                        }
                      ],
                      "sid": 102587904877208
                    }
                  ]
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "else",
                  "objectClass": "System",
                  "sid": 438202966715082
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 323440640946068,
                  "parameters": {
                    "variable": "refillBusy",
                    "value": "0"
                  }
                }
              ],
              "sid": 521875020905418
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 325244863663267,
                  "parameters": {
                    "first-value": "refillBusy",
                    "comparison": 0,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [],
              "sid": 341877457596246
            }
          ]
        }
      ],
      "sid": 359719572700957
    },
    {
      "eventType": "block",
      "conditions": [
        {
          "id": "every-x-seconds",
          "objectClass": "System",
          "sid": 871753979276480,
          "parameters": {
            "interval-seconds": "0.015"
          }
        }
      ],
      "actions": [],
      "sid": 139584833063626,
      "children": [
        {
          "eventType": "variable",
          "name": "c",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 456992582349601
        },
        {
          "eventType": "variable",
          "name": "r",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 467810796311288
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 442212059238478,
              "parameters": {
                "first-value": "refillBusy",
                "comparison": 0,
                "second-value": "1"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 796297941072905,
              "parameters": {
                "first-value": "RefillStep",
                "comparison": 2,
                "second-value": "GemRefillArray.Width/2"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 844769589039650,
              "parameters": {
                "variable": "c",
                "value": "GemRefillArray.At(RefillStep*2)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 472911139542551,
              "parameters": {
                "variable": "r",
                "value": "GemRefillArray.At(RefillStep*2+1)"
              }
            }
          ],
          "sid": 919377001443571
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-at-xy",
              "objectClass": "Grid",
              "sid": 185137638420857,
              "parameters": {
                "x": "c",
                "y": "r",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "create-object",
              "objectClass": "System",
              "sid": 603331435528775,
              "parameters": {
                "object-to-create": "Gem",
                "layer": "\"Game\"",
                "x": "gx + c * (cellSize+gap) + cellSize/2",
                "y": "gy + r * (cellSize+gap) + cellSize/2",
                "create-hierarchy": false,
                "template-name": "\"\""
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "Gem",
              "sid": 437254889830858,
              "parameters": {
                "instance-variable": "cellC",
                "value": "c"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "Gem",
              "sid": 551442637219727,
              "parameters": {
                "instance-variable": "cellR",
                "value": "r"
              }
            },
            {
              "id": "set-size",
              "objectClass": "Gem",
              "sid": 480831720309551,
              "parameters": {
                "width": "cellSize",
                "height": "cellSize"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "Gem",
              "sid": 896313046261233,
              "parameters": {
                "frame-number": "int(random(Gem.AnimationFrameCount))"
              }
            },
            {
              "id": "stop-animation",
              "objectClass": "Gem",
              "sid": 873950682913339
            },
            {
              "id": "set-at-xyz",
              "objectClass": "Grid",
              "sid": 315093969646076,
              "parameters": {
                "x": "c",
                "y": "r",
                "z": "0",
                "value": "Gem.UID"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "Gem",
              "sid": 628036879091879,
              "parameters": {
                "instance-variable": "elementIndex",
                "value": "Gem.AnimationFrame"
              }
            }
          ],
          "sid": 661906515911391
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 738773217777271,
              "parameters": {
                "variable": "RefillStep",
                "value": "1"
              }
            }
          ],
          "sid": 903427293765503
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "else",
              "objectClass": "System",
              "sid": 185930624645826
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 532816696695754,
              "parameters": {
                "variable": "refillBusy",
                "value": "0"
              }
            }
          ],
          "sid": 404935094405991
        }
      ]
    },
    {
      "functionName": "DestroyGem",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 462059622978713,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-all",
              "objectClass": "System",
              "sid": 948712405718312,
              "parameters": {
                "object": "Gem"
              }
            },
            {
              "id": "pick-by-comparison",
              "objectClass": "System",
              "sid": 676103451936331,
              "parameters": {
                "object": "Gem",
                "expression": "Gem.Selected",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-at-xyz",
              "objectClass": "Grid",
              "sid": 490290581654709,
              "parameters": {
                "x": "Gem.cellC",
                "y": "Gem.cellR",
                "z": "0",
                "value": "0"
              }
            },
            {
              "id": "destroy",
              "objectClass": "Gem",
              "sid": 372761876040963
            }
          ],
          "sid": 122976792947136
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [],
          "sid": 332965480013345
        }
      ]
    },
    {
      "functionName": "ClearMatchState",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 858981821878716,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-all",
              "objectClass": "System",
              "sid": 961892162501809,
              "parameters": {
                "object": "Gem"
              }
            }
          ],
          "actions": [
            {
              "id": "set-instvar-value",
              "objectClass": "Gem",
              "sid": 812029458829927,
              "parameters": {
                "instance-variable": "Selected",
                "value": "0"
              }
            },
            {
              "id": "set-opacity",
              "objectClass": "Gem",
              "sid": 845803155408174,
              "parameters": {
                "opacity": "100"
              }
            },
            {
              "id": "set-size",
              "objectClass": "Gem",
              "sid": 582805720914399,
              "parameters": {
                "width": "cellSize",
                "height": "cellSize"
              }
            },
            {
              "id": "clear",
              "objectClass": "TapSeq",
              "sid": 974449664302405,
              "parameters": {
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 278940286211428,
              "parameters": {
                "variable": "TapIndex",
                "value": "0"
              }
            }
          ],
          "sid": 310553508154699
        }
      ]
    },
    {
      "functionName": "OpenOverlay",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 857976681667803,
          "parameters": {
            "variable": "UIOverlay",
            "value": "true"
          }
        },
        {
          "id": "set-group-active",
          "objectClass": "System",
          "sid": 685157468276024,
          "parameters": {
            "group-name": "\"Gameplay\"",
            "state": "deactivated"
          }
        },
        {
          "id": "set-visible",
          "objectClass": "InputBlocker",
          "sid": 813996403506046,
          "parameters": {
            "visibility": "visible"
          }
        }
      ],
      "sid": 445025493153890
    },
    {
      "functionName": "CloseOverlay",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-boolean-eventvar",
          "objectClass": "System",
          "sid": 913653995454688,
          "parameters": {
            "variable": "UIOverlay",
            "value": "false"
          }
        },
        {
          "id": "set-group-active",
          "objectClass": "System",
          "sid": 810882060469961,
          "parameters": {
            "group-name": "\"Gameplay\"",
            "state": "activated"
          }
        },
        {
          "id": "set-visible",
          "objectClass": "InputBlocker",
          "sid": 371264120091899,
          "parameters": {
            "visibility": "invisible"
          }
        }
      ],
      "sid": 871499528067993
    },
    {
      "functionName": "Sub_Energy",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "subtract-from-eventvar",
          "objectClass": "System",
          "sid": 980402516561646,
          "parameters": {
            "variable": "Player_Energy",
            "value": "3"
          }
        },
        {
          "id": "set-text",
          "objectClass": "Text_Energy",
          "sid": 857359996109215,
          "parameters": {
            "text": "Player_Energy & \"n\""
          }
        }
      ],
      "sid": 379064118885107
    },
    {
      "functionName": "Update_Bars",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 849632674552457,
      "children": [
        {
          "eventType": "variable",
          "name": "totalCur",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 371971255840214
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 683947072212003,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            }
          ],
          "actions": [],
          "sid": 474714307957210,
          "children": [
            {
              "eventType": "block",
              "conditions": [],
              "actions": [],
              "sid": 286632409994880
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-children",
                  "objectClass": "Enemy_Sprite",
                  "sid": 993127369911637,
                  "parameters": {
                    "child": "Bar_Fill",
                    "which": "own"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-instvar-value",
                  "objectClass": "Bar_Fill",
                  "sid": 583656935772582,
                  "parameters": {
                    "instance-variable": "targetWidth",
                    "value": "Bar_Fill.baseW * (Enemy_Sprite.HP / Enemy_Sprite.maxHP)"
                  }
                }
              ],
              "sid": 448184194290065,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-instance-variable",
                      "objectClass": "Enemy_Sprite",
                      "sid": 542495561559081,
                      "parameters": {
                        "instance-variable": "HP",
                        "comparison": 4,
                        "value": "0"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-visible",
                      "objectClass": "Bar_Fill",
                      "sid": 471233644426828,
                      "parameters": {
                        "visibility": "visible"
                      }
                    }
                  ],
                  "sid": 567958814476837
                },
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "else",
                      "objectClass": "System",
                      "sid": 413239188107278
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-visible",
                      "objectClass": "Bar_Fill",
                      "sid": 357903258513558,
                      "parameters": {
                        "visibility": "invisible"
                      }
                    }
                  ],
                  "sid": 231686296870601
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-children",
                  "objectClass": "Enemy_Sprite",
                  "sid": 546234596493742,
                  "parameters": {
                    "child": "Bar_Yellow",
                    "which": "own"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-instvar-value",
                  "objectClass": "Bar_Yellow",
                  "sid": 640776083788150,
                  "parameters": {
                    "instance-variable": "targetWidth",
                    "value": "Bar_Yellow.baseW * (Enemy_Sprite.HP / Enemy_Sprite.maxHP)"
                  }
                }
              ],
              "sid": 964764090860070,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-instance-variable",
                      "objectClass": "Enemy_Sprite",
                      "sid": 183937790041776,
                      "parameters": {
                        "instance-variable": "HP",
                        "comparison": 4,
                        "value": "0"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-visible",
                      "objectClass": "Bar_Yellow",
                      "sid": 233629636258858,
                      "parameters": {
                        "visibility": "visible"
                      }
                    }
                  ],
                  "sid": 940366026455347
                },
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "else",
                      "objectClass": "System",
                      "sid": 921069653115384
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-visible",
                      "objectClass": "Bar_Yellow",
                      "sid": 887293811274993,
                      "parameters": {
                        "visibility": "invisible"
                      }
                    }
                  ],
                  "sid": 875642012019325
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-children",
                  "objectClass": "Enemy_Sprite",
                  "sid": 830789153099705,
                  "parameters": {
                    "child": "Bar_Back",
                    "which": "own"
                  }
                }
              ],
              "actions": [],
              "sid": 914935663008080,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-instance-variable",
                      "objectClass": "Enemy_Sprite",
                      "sid": 105455387588593,
                      "parameters": {
                        "instance-variable": "HP",
                        "comparison": 4,
                        "value": "0"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-visible",
                      "objectClass": "Bar_Back",
                      "sid": 280129917055121,
                      "parameters": {
                        "visibility": "visible"
                      }
                    }
                  ],
                  "sid": 486538067819056
                },
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "else",
                      "objectClass": "System",
                      "sid": 353796603585992
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-visible",
                      "objectClass": "Bar_Back",
                      "sid": 523263669339643,
                      "parameters": {
                        "visibility": "invisible"
                      }
                    }
                  ],
                  "sid": 644074967724449
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "functionName": "BuildTurnOrder",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-size",
          "objectClass": "TurnOrderArray",
          "sid": 218377682011251,
          "parameters": {
            "width": "0",
            "height": "1",
            "depth": "1"
          }
        },
        {
          "id": "clear",
          "objectClass": "TurnOrderArray",
          "sid": 608162247612516,
          "parameters": {
            "value": "0"
          }
        }
      ],
      "sid": 983172396068001,
      "children": [
        {
          "eventType": "variable",
          "name": "init",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 401339368695132
        },
        {
          "eventType": "variable",
          "name": "heroCountInTO",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 605132460680597
        },
        {
          "eventType": "variable",
          "name": "enemyCountInTO",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 288361738561659
        },
        {
          "eventType": "variable",
          "name": "realUID",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 215442701995371
        },
        {
          "eventType": "variable",
          "name": "uid",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 288614631146008
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 273852918811834,
              "parameters": {
                "object": "Heroes"
              }
            }
          ],
          "actions": [],
          "sid": 543240517014860,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 328050804574999,
                  "parameters": {
                    "instance-variable": "HP",
                    "comparison": 4,
                    "value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 938688767835428,
                  "parameters": {
                    "variable": "init",
                    "value": "(Heroes.SPD + PartyBuff_SPD + random(-1,1))"
                  }
                },
                {
                  "id": "push",
                  "objectClass": "TurnOrderArray",
                  "sid": 588157578964941,
                  "parameters": {
                    "where": "back",
                    "value": "Heroes.UID",
                    "axis": "x"
                  }
                },
                {
                  "id": "push",
                  "objectClass": "TurnOrderArray",
                  "sid": 685393435659377,
                  "parameters": {
                    "where": "back",
                    "value": "init",
                    "axis": "x"
                  }
                },
                {
                  "id": "push",
                  "objectClass": "TurnOrderArray",
                  "sid": 138380028312256,
                  "parameters": {
                    "where": "back",
                    "value": "0",
                    "axis": "x"
                  }
                },
                {
                  "id": "add-to-eventvar",
                  "objectClass": "System",
                  "sid": 314368281297517,
                  "parameters": {
                    "variable": "heroCountInTO",
                    "value": "1"
                  }
                }
              ],
              "sid": 652824325899787
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 404693484289232,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "Slots-1"
              }
            }
          ],
          "actions": [],
          "sid": 537777672211613,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 644578246891444,
                  "parameters": {
                    "first-value": "EnemySlots.At(loopindex(\"i\"),0,0)",
                    "comparison": 4,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 358511271751231,
                  "parameters": {
                    "variable": "realUID",
                    "value": "EnemySlots.At(LoopIndex(\"i\"), 0, 0)-1"
                  }
                }
              ],
              "sid": 555147731484044,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "pick-by-unique-id",
                      "objectClass": "Enemy_Sprite",
                      "sid": 434534011433746,
                      "parameters": {
                        "unique-id": "realUID"
                      }
                    },
                    {
                      "id": "compare-instance-variable",
                      "objectClass": "Enemy_Sprite",
                      "sid": 974459520715066,
                      "parameters": {
                        "instance-variable": "HP",
                        "comparison": 4,
                        "value": "0"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 415990611953126,
                      "disabled": true,
                      "parameters": {
                        "variable": "uid",
                        "value": "Enemy_Sprite.UID"
                      }
                    },
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 556234766053520,
                      "parameters": {
                        "variable": "init",
                        "value": "(Enemy_Sprite.SPD+random(-1,1))"
                      }
                    },
                    {
                      "id": "push",
                      "objectClass": "TurnOrderArray",
                      "sid": 738370374164592,
                      "parameters": {
                        "where": "back",
                        "value": "realUID",
                        "axis": "x"
                      }
                    },
                    {
                      "id": "push",
                      "objectClass": "TurnOrderArray",
                      "sid": 508251328288761,
                      "parameters": {
                        "where": "back",
                        "value": "init",
                        "axis": "x"
                      }
                    },
                    {
                      "id": "push",
                      "objectClass": "TurnOrderArray",
                      "sid": 659451142367090,
                      "parameters": {
                        "where": "back",
                        "value": "1",
                        "axis": "x"
                      }
                    },
                    {
                      "id": "add-to-eventvar",
                      "objectClass": "System",
                      "sid": 466186351436270,
                      "parameters": {
                        "variable": "enemyCountInTO",
                        "value": "1"
                      }
                    }
                  ],
                  "sid": 192573876879251
                }
              ]
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "SortTurnOrder",
              "sid": 107375049705652
            },
            {
              "callFunction": "debugTurnOrder",
              "sid": 135753726333622
            }
          ],
          "sid": 645308155670113
        }
      ]
    },
    {
      "functionName": "SortTurnOrder",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 581140848733393,
      "children": [
        {
          "eventType": "variable",
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 257867785989061
        },
        {
          "eventType": "variable",
          "name": "j",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 808447230472408
        },
        {
          "eventType": "variable",
          "name": "tempUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 478450567398068
        },
        {
          "eventType": "variable",
          "name": "tempSPD",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 994025036431325
        },
        {
          "eventType": "variable",
          "name": "tempType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 635531497331421
        },
        {
          "eventType": "variable",
          "name": "count",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 189195848979413
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 685828316041605,
              "parameters": {
                "variable": "count",
                "value": "TurnOrderArray.Width/3"
              }
            }
          ],
          "sid": 437063982418148
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 216252122011742,
              "parameters": {
                "first-value": "count",
                "comparison": 3,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 651880308302022
            }
          ],
          "sid": 310934675870216
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 492035854639501,
              "parameters": {
                "first-value": "count",
                "comparison": 4,
                "second-value": "1"
              }
            }
          ],
          "actions": [],
          "sid": 790352358419877
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 847878969011056,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "count-2"
              }
            }
          ],
          "actions": [],
          "sid": 224619718844821,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 462105199167807,
                  "parameters": {
                    "name": "\"j\"",
                    "start-index": "loopindex(\"i\")+1",
                    "end-index": "count-1"
                  }
                }
              ],
              "actions": [],
              "sid": 900710706793559,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 672078328150128,
                      "parameters": {
                        "first-value": "TurnOrderArray.At(LoopIndex(\"j\")*3+1)",
                        "comparison": 4,
                        "second-value": "TurnOrderArray.At(LoopIndex(\"i\")*3+1)"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 898639420796477,
                      "parameters": {
                        "variable": "tempUID",
                        "value": "TurnOrderArray.At(LoopIndex(\"i\")*3)"
                      }
                    },
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 194884976911286,
                      "parameters": {
                        "variable": "tempSPD",
                        "value": "TurnOrderArray.At(LoopIndex(\"i\")*3+1)"
                      }
                    },
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 704850301825326,
                      "parameters": {
                        "variable": "tempType",
                        "value": "TurnOrderArray.At(LoopIndex(\"i\")*3+2)"
                      }
                    },
                    {
                      "id": "set-at-x",
                      "objectClass": "TurnOrderArray",
                      "sid": 385433761951037,
                      "parameters": {
                        "x": "loopindex(\"i\")*3",
                        "value": "TurnOrderArray.At(LoopIndex(\"j\")*3)\n"
                      }
                    },
                    {
                      "id": "set-at-x",
                      "objectClass": "TurnOrderArray",
                      "sid": 185659203765437,
                      "parameters": {
                        "x": "loopindex(\"i\")*3+1",
                        "value": "TurnOrderArray.At(LoopIndex(\"j\")*3+1)\n"
                      }
                    },
                    {
                      "id": "set-at-x",
                      "objectClass": "TurnOrderArray",
                      "sid": 189721562731843,
                      "parameters": {
                        "x": "loopindex(\"i\")*3+2",
                        "value": "TurnOrderArray.At(LoopIndex(\"j\")*3+2)\n"
                      }
                    },
                    {
                      "id": "set-at-x",
                      "objectClass": "TurnOrderArray",
                      "sid": 325489210275940,
                      "parameters": {
                        "x": "loopindex(\"j\")*3",
                        "value": "tempUID"
                      }
                    },
                    {
                      "id": "set-at-x",
                      "objectClass": "TurnOrderArray",
                      "sid": 277356527779599,
                      "parameters": {
                        "x": "loopindex(\"j\")*3+1",
                        "value": "tempSPD"
                      }
                    },
                    {
                      "id": "set-at-x",
                      "objectClass": "TurnOrderArray",
                      "sid": 483541701826260,
                      "parameters": {
                        "x": "loopindex(\"j\")*3+2",
                        "value": "tempType"
                      }
                    }
                  ],
                  "sid": 939157691461567
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "functionName": "GetCurrentTurn",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-function-return-value",
          "objectClass": "Functions",
          "sid": 181347572723169,
          "parameters": {
            "value": "TurnOrderArray.At(CurrentTurnIndex*3)"
          }
        }
      ],
      "sid": 313968949870041
    },
    {
      "functionName": "GetCurrentType",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-function-return-value",
          "objectClass": "Functions",
          "sid": 116879583291047,
          "parameters": {
            "value": "TurnOrderArray.At(CurrentTurnIndex*3+2)"
          }
        }
      ],
      "sid": 879230862523283
    },
    {
      "functionName": "AdvanceTurn",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 609952015953604,
      "children": [
        {
          "eventType": "variable",
          "name": "curUID",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 655539356768288
        },
        {
          "eventType": "variable",
          "name": "curType",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 468493864089212
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 243406519081282,
              "parameters": {
                "variable": "curUID",
                "value": "Functions.GetCurrentTurn"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 430680340041517,
              "parameters": {
                "variable": "curType",
                "value": "Functions.GetCurrentType"
              }
            }
          ],
          "sid": 791219146822193
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 403638345049711,
              "parameters": {
                "first-value": "curType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 150988978460761,
              "parameters": {
                "unique-id": "curUID"
              }
            }
          ],
          "actions": [
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 368866586594374,
              "parameters": {
                "variable": "HeroTurnClock",
                "value": "1"
              }
            }
          ],
          "sid": 207726623291053
        },
        {
          "eventType": "comment",
          "text": "// DEF expire (frame 0)"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 870551060583740,
              "parameters": {
                "first-value": "curType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 697512763736284,
              "parameters": {
                "first-value": "BuffExpire_DEF",
                "comparison": 5,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 241333156551844,
              "parameters": {
                "first-value": "HeroTurnClock",
                "comparison": 5,
                "second-value": "BuffExpire_DEF"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 321743107996700,
              "parameters": {
                "variable": "PartyBuff_DEF",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 319915986674118,
              "parameters": {
                "variable": "BuffExpire_DEF",
                "value": "-1"
              }
            },
            {
              "callFunction": "RemovePartyBuffSlot",
              "sid": 418719836152604,
              "parameters": [
                "0"
              ]
            }
          ],
          "sid": 764626470711430
        },
        {
          "eventType": "comment",
          "text": "// ATK expire (frame 1)"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 181370046822986,
              "parameters": {
                "first-value": "curType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 363305609923893,
              "parameters": {
                "first-value": "BuffExpire_ATK",
                "comparison": 5,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 250997323757112,
              "parameters": {
                "first-value": "HeroTurnClock",
                "comparison": 5,
                "second-value": "BuffExpire_ATK"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 920912087916088,
              "parameters": {
                "variable": "PartyBuff_ATK",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 506459759417996,
              "parameters": {
                "variable": "BuffExpire_ATK",
                "value": "-1"
              }
            },
            {
              "callFunction": "RemovePartyBuffSlot",
              "sid": 732765274392841,
              "parameters": [
                "1"
              ]
            }
          ],
          "sid": 441974762917747
        },
        {
          "eventType": "comment",
          "text": "// MAG expire (frame 2)"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 460290112672987,
              "parameters": {
                "first-value": "curType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 389319883429783,
              "parameters": {
                "first-value": "BuffExpire_MAG",
                "comparison": 5,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 168162208066822,
              "parameters": {
                "first-value": "HeroTurnClock",
                "comparison": 5,
                "second-value": "BuffExpire_MAG"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 314820967049563,
              "parameters": {
                "variable": "PartyBuff_MAG",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 619209983733230,
              "parameters": {
                "variable": "BuffExpire_MAG",
                "value": "-1"
              }
            },
            {
              "callFunction": "RemovePartyBuffSlot",
              "sid": 172389890011078,
              "parameters": [
                "2"
              ]
            }
          ],
          "sid": 272199764728429
        },
        {
          "eventType": "comment",
          "text": "// SPD expire (frame 3)"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 116161932577707,
              "parameters": {
                "first-value": "curType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 286478812583413,
              "parameters": {
                "first-value": "BuffExpire_SPD",
                "comparison": 5,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 392424128433024,
              "parameters": {
                "first-value": "HeroTurnClock",
                "comparison": 5,
                "second-value": "BuffExpire_SPD"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 296247177948470,
              "parameters": {
                "variable": "PartyBuff_SPD",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 387590724783092,
              "parameters": {
                "variable": "BuffExpire_SPD",
                "value": "-1"
              }
            },
            {
              "callFunction": "RemovePartyBuffSlot",
              "sid": 806863936602282,
              "parameters": [
                "3"
              ]
            }
          ],
          "sid": 724224349858499
        },
        {
          "eventType": "comment",
          "text": "// RES expire (frame 4)"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 969467147049974,
              "parameters": {
                "first-value": "curType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 267463009522661,
              "parameters": {
                "first-value": "BuffExpire_RES",
                "comparison": 5,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 333395514357907,
              "parameters": {
                "first-value": "HeroTurnClock",
                "comparison": 5,
                "second-value": "BuffExpire_RES"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 938086956262459,
              "parameters": {
                "variable": "PartyBuff_RES",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 985977276130332,
              "parameters": {
                "variable": "BuffExpire_RES",
                "value": "-1"
              }
            },
            {
              "callFunction": "RemovePartyBuffSlot",
              "sid": 238569187937950,
              "parameters": [
                "4"
              ]
            }
          ],
          "sid": 844878420008376
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 716590526021624,
              "parameters": {
                "variable": "CurrentTurnIndex",
                "value": "1"
              }
            }
          ],
          "sid": 536189356892186,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 775447546114900,
                  "parameters": {
                    "first-value": "CurrentTurnIndex",
                    "comparison": 5,
                    "second-value": "TurnOrderArray.Width/3"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 104594398056599,
                  "parameters": {
                    "variable": "CurrentTurnIndex",
                    "value": "0"
                  }
                },
                {
                  "callFunction": "BuildTurnOrder",
                  "sid": 786209642089618
                }
              ],
              "sid": 386888421833556
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 456770035326660
            }
          ],
          "sid": 925191706781060
        }
      ]
    },
    {
      "functionName": "ProcessTurn",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 153351964966336,
      "children": [
        {
          "eventType": "variable",
          "name": "actorType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 808480722601035
        },
        {
          "eventType": "comment",
          "text": "// HERO TURN – ONLY IF ALIVE"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 374076968773767,
              "parameters": {
                "first-value": "Functions.GetCurrentType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 949932486726943,
              "parameters": {
                "unique-id": "Functions.GetCurrentTurn"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Heroes",
              "sid": 119902848882038,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "HeroTurn",
              "sid": 896146756194169,
              "parameters": [
                "Functions.GetCurrentTurn"
              ]
            }
          ],
          "sid": 248470017699937
        },
        {
          "eventType": "comment",
          "text": "// HERO ENTRY BUT HERO IS DEAD OR MISSING → SKIP"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 689855136383285,
              "parameters": {
                "first-value": "Functions.GetCurrentType",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 893290203317355,
              "parameters": {
                "unique-id": "Functions.GetCurrentTurn"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Heroes",
              "sid": 960880447398809,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 3,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "AdvanceTurn",
              "sid": 259495752368951
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 870573930849531
            }
          ],
          "sid": 131967672132473
        },
        {
          "eventType": "comment",
          "text": "// ENEMY TURN – ONLY IF ALIVE"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 442340521294749,
              "parameters": {
                "first-value": "Functions.GetCurrentType",
                "comparison": 0,
                "second-value": "1"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 827050504960217,
              "parameters": {
                "unique-id": "Functions.GetCurrentTurn"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 367721807211633,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "EnemyTurn",
              "sid": 376920544629772,
              "parameters": [
                "Functions.GetCurrentTurn"
              ]
            }
          ],
          "sid": 399575787990407
        },
        {
          "eventType": "comment",
          "text": "// ENEMY ENTRY BUT ENEMY IS DEAD OR MISSING → SKIP"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 354521761381062,
              "parameters": {
                "first-value": "Functions.GetCurrentType",
                "comparison": 0,
                "second-value": "1"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 209707175766979,
              "parameters": {
                "unique-id": "Functions.GetCurrentTurn"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 831642018890551,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 3,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "AdvanceTurn",
              "sid": 559598467792459
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 389313092321824
            }
          ],
          "sid": 136899966176561
        },
        {
          "eventType": "comment",
          "text": "// FALLBACK – BAD TYPE OR CORRUPT ENTRY"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 193551887829184,
              "parameters": {
                "first-value": "Functions.GetCurrentType",
                "comparison": 1,
                "second-value": "0"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 123422390264101,
              "parameters": {
                "first-value": "Functions.GetCurrentType",
                "comparison": 1,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "AdvanceTurn",
              "sid": 327833297185297
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 965899122280394
            }
          ],
          "sid": 452770600321458
        }
      ]
    },
    {
      "functionName": "HeroTurn",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "heroUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 531535335210551
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 415041577691761,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-all",
              "objectClass": "System",
              "sid": 746099372764701,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            }
          ],
          "actions": [
            {
              "id": "set-instvar-value",
              "objectClass": "Enemy_Sprite",
              "sid": 569681484361861,
              "parameters": {
                "instance-variable": "IsSelected",
                "value": "0"
              }
            },
            {
              "callFunction": "Update_Bars",
              "sid": 908151730381205
            },
            {
              "id": "destroy",
              "objectClass": "Selector",
              "sid": 627161857767124
            }
          ],
          "sid": 188720450624745
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 141802002475608,
              "parameters": {
                "unique-id": "heroUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-position",
              "objectClass": "heroSelect",
              "sid": 375434120856702,
              "parameters": {
                "x": "Heroes.X",
                "y": "Heroes.Y+35"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "heroSelect",
              "sid": 484238801641906,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 797888655461159,
              "parameters": {
                "variable": "TurnPhase",
                "value": "0"
              }
            },
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 634172066840631,
              "parameters": {
                "variable": "CanPickGems",
                "value": "true"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 670814198789941,
              "parameters": {
                "variable": "IsPlayerBusy",
                "value": "0"
              }
            }
          ],
          "sid": 679562045921720
        }
      ]
    },
    {
      "functionName": "EnemyTurn",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 302340855721502
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 380227372332614,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-all",
              "objectClass": "System",
              "sid": 798808052506161,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            }
          ],
          "actions": [
            {
              "id": "set-instvar-value",
              "objectClass": "Enemy_Sprite",
              "sid": 490234473053886,
              "parameters": {
                "instance-variable": "IsSelected",
                "value": "0"
              }
            },
            {
              "callFunction": "Update_Bars",
              "sid": 166232631298537
            },
            {
              "id": "destroy",
              "objectClass": "Selector",
              "sid": 827183650264067
            }
          ],
          "sid": 696529725077630
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 478743594233701,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "heroSelect",
              "sid": 201168581483784,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 359718679753101,
              "parameters": {
                "variable": "TurnPhase",
                "value": "2"
              }
            },
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 783738920704897,
              "parameters": {
                "variable": "CanPickGems",
                "value": "false"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 177539815169885,
              "parameters": {
                "variable": "IsPlayerBusy",
                "value": "1"
              }
            },
            {
              "id": "wait",
              "objectClass": "System",
              "sid": 312766814327872,
              "parameters": {
                "seconds": "0.5",
                "use-timescale": true
              }
            },
            {
              "callFunction": "EnemyAttack",
              "sid": 334836286116827,
              "parameters": [
                "enemyUID"
              ]
            }
          ],
          "sid": 658293111727670
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "else",
              "objectClass": "System",
              "sid": 371819144272257
            }
          ],
          "actions": [
            {
              "callFunction": "AdvanceTurn",
              "sid": 411731763859116
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 853046660420809
            }
          ],
          "sid": 488104403761068
        }
      ]
    },
    {
      "functionName": "EnemyAttack",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 617729501088375
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 958581614608706,
      "children": [
        {
          "eventType": "variable",
          "name": "targetHeroUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 567238804729081
        },
        {
          "eventType": "variable",
          "name": "randomHeroUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 432446765128254
        },
        {
          "eventType": "variable",
          "name": "randomHeroIndex",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 923775177472906
        },
        {
          "eventType": "variable",
          "name": "heroCount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 353229667967938
        },
        {
          "eventType": "variable",
          "name": "enemyNameText",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 204061480704895
        },
        {
          "eventType": "variable",
          "name": "heroNameText",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 169837401565444
        },
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 131779535136403
        },
        {
          "eventType": "variable",
          "name": "handled",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 866203964984751
        },
        {
          "eventType": "comment",
          "text": "// RESET FLAGS / COUNT"
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 553838336131765,
              "parameters": {
                "variable": "handled",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 936666072747394,
              "parameters": {
                "variable": "heroCount",
                "value": "0"
              }
            }
          ],
          "sid": 538138825348172,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 940580495650965,
                  "parameters": {
                    "instance-variable": "HP",
                    "comparison": 4,
                    "value": "0"
                  }
                },
                {
                  "id": "for-each",
                  "objectClass": "System",
                  "sid": 423316141902791,
                  "parameters": {
                    "object": "Heroes"
                  }
                }
              ],
              "actions": [
                {
                  "id": "add-to-eventvar",
                  "objectClass": "System",
                  "sid": 488792148387343,
                  "parameters": {
                    "variable": "heroCount",
                    "value": "1"
                  }
                }
              ],
              "sid": 321084937712055
            }
          ]
        },
        {
          "eventType": "comment",
          "text": "// IF NO LIVING HEROES → ADVANCE TURN AND EXIT"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 736960011178343,
              "parameters": {
                "first-value": "heroCount",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 533585577575936,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 367818650729416,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "id": "set-y",
              "objectClass": "Enemy_Sprite",
              "sid": 427145962999057,
              "parameters": {
                "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 383225846977296
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 744239991908399
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 650169359866964
            }
          ],
          "sid": 944607393769729
        },
        {
          "eventType": "comment",
          "text": "// POSITION ENEMY / NAME"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 668617830067854,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 556022358541727,
              "parameters": {
                "variable": "enemyNameText",
                "value": "Enemy_Sprite.name"
              }
            },
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 414040982660112,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex) - 55"
              }
            }
          ],
          "sid": 353649338046126
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 309221154761009,
              "parameters": {
                "variable": "handled",
                "value": "Functions.ResolveEnemyAction(enemyUID)"
              }
            }
          ],
          "sid": 270845649811404
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 729783821068178,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 909265122759845,
              "parameters": {
                "variable": "handled",
                "value": "Functions.ExecuteEnemySkill(\"Enemy_ATK_Single\", enemyUID)"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 105296556113392
            }
          ],
          "sid": 789672835106290
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 273448402879247,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 623622887395572
            }
          ],
          "sid": 109912118414473,
          "disabled": true
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 923423668281384,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 191451625301654,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 734729787944749,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "id": "set-y",
              "objectClass": "Enemy_Sprite",
              "sid": 953224260730253,
              "parameters": {
                "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 292642363605454
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 971143879486176
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 204671285448076
            }
          ],
          "sid": 220309513662420
        }
      ]
    },
    {
      "functionName": "debugTurnOrder",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 445514490833812,
      "children": [
        {
          "eventType": "variable",
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 254638665205979
        },
        {
          "eventType": "variable",
          "name": "count",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 643604175982218
        },
        {
          "eventType": "variable",
          "name": "uid",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 757519790826060
        },
        {
          "eventType": "variable",
          "name": "type",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 147649509959057
        },
        {
          "eventType": "variable",
          "name": "initVal",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 761813757947863
        },
        {
          "eventType": "variable",
          "name": "spdVal",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 114988930854513
        },
        {
          "eventType": "variable",
          "name": "nameVal",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 754121420611632
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 101382707053779,
              "parameters": {
                "variable": "count",
                "value": "TurnOrderArray.Width/3"
              }
            },
            {
              "id": "set-text",
              "objectClass": "turnTracker",
              "sid": 507956696235345,
              "parameters": {
                "text": "\"TurnOrder (\" & count & \"):\" & newline"
              }
            }
          ],
          "sid": 716977434560659
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 326427800160889,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "count-1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 953201626857075,
              "parameters": {
                "variable": "uid",
                "value": "TurnOrderArray.At(loopindex(\"i\")*3)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 238641190720601,
              "parameters": {
                "variable": "initVal",
                "value": "TurnOrderArray.At(loopindex(\"i\")*3+1)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 629883041849163,
              "parameters": {
                "variable": "type",
                "value": "TurnOrderArray.At(loopindex(\"i\")*3+2)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 329695249993929,
              "parameters": {
                "variable": "spdVal",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 417585617352220,
              "parameters": {
                "variable": "nameVal",
                "value": "\"?\""
              }
            }
          ],
          "sid": 929790298710930,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-eventvar",
                  "objectClass": "System",
                  "sid": 653428038792320,
                  "parameters": {
                    "variable": "type",
                    "comparison": 0,
                    "value": "0"
                  }
                },
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Heroes",
                  "sid": 260369359695451,
                  "parameters": {
                    "unique-id": "uid"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 769019029602566,
                  "parameters": {
                    "variable": "spdVal",
                    "value": "Heroes.SPD"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 329548387916941,
                  "parameters": {
                    "variable": "nameVal",
                    "value": "Heroes.name"
                  }
                }
              ],
              "sid": 489194189356724
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-eventvar",
                  "objectClass": "System",
                  "sid": 773915511376176,
                  "parameters": {
                    "variable": "type",
                    "comparison": 0,
                    "value": "1"
                  }
                },
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Enemy_Sprite",
                  "sid": 807823757507879,
                  "parameters": {
                    "unique-id": "uid"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 953301988492943,
                  "parameters": {
                    "variable": "spdVal",
                    "value": "Enemy_Sprite.SPD"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 266977485992963,
                  "parameters": {
                    "variable": "nameVal",
                    "value": "Enemy_Sprite.name"
                  }
                }
              ],
              "sid": 904156315443578
            },
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "id": "set-text",
                  "objectClass": "turnTracker",
                  "sid": 594729152330870,
                  "parameters": {
                    "text": "turnTracker.Text\n                & \"i=\" & LoopIndex(\"i\")\n                & \" | type=\" & type\n                & \" | \" & nameVal\n                & \" | SPD=\" & spdVal\n                & newline"
                  }
                }
              ],
              "sid": 157566870248475
            }
          ]
        }
      ]
    },
    {
      "functionName": "UpdateHeroHPUI",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 270576950237044,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 840115487489238,
              "parameters": {
                "object": "Heroes"
              }
            }
          ],
          "actions": [],
          "sid": 590026850741009,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 491875387225899,
                  "parameters": {
                    "instance-variable": "heroIndex",
                    "comparison": 0,
                    "value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-text",
                  "objectClass": "h1name",
                  "sid": 641118649208805,
                  "parameters": {
                    "text": "Heroes.name"
                  }
                }
              ],
              "sid": 486305526737460
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 653497045454110,
                  "parameters": {
                    "instance-variable": "heroIndex",
                    "comparison": 0,
                    "value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-text",
                  "objectClass": "h2Hname",
                  "sid": 331882077418315,
                  "parameters": {
                    "text": "Heroes.name"
                  }
                }
              ],
              "sid": 103104948034029
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 952480755577452,
                  "parameters": {
                    "instance-variable": "heroIndex",
                    "comparison": 0,
                    "value": "2"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-text",
                  "objectClass": "h3name",
                  "sid": 672716606504709,
                  "parameters": {
                    "text": "Heroes.name"
                  }
                }
              ],
              "sid": 497007016139241
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 992352818775456,
                  "parameters": {
                    "instance-variable": "heroIndex",
                    "comparison": 0,
                    "value": "3"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-text",
                  "objectClass": "h4name",
                  "sid": 965449238495452,
                  "parameters": {
                    "text": "Heroes.name"
                  }
                }
              ],
              "sid": 835185900457182
            }
          ]
        }
      ]
    },
    {
      "functionName": "HealCalc",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "healerUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 236469912979947
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 425107681408503,
      "children": [
        {
          "eventType": "variable",
          "name": "mag",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 194353683708207
        },
        {
          "eventType": "variable",
          "name": "maxHP",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 315222160687430
        },
        {
          "eventType": "variable",
          "name": "heal",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 723173241737409
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 760743894973678,
              "parameters": {
                "unique-id": "healerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 693099715766324,
              "parameters": {
                "variable": "mag",
                "value": "Heroes.MAG"
              }
            },
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 396657636854749,
              "parameters": {
                "variable": "mag",
                "value": "PartyBuff_MAG"
              }
            }
          ],
          "sid": 710439006374964
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 655895779170590,
              "parameters": {
                "unique-id": "healerUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 977013444235493,
              "parameters": {
                "variable": "mag",
                "value": "Enemy_Sprite.MAG"
              }
            }
          ],
          "sid": 657804243559070
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 394544913141311,
              "parameters": {
                "variable": "heal",
                "value": "ceil(10+(mag*0.8)+random(6))"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 553925800386960,
              "parameters": {
                "variable": "heal",
                "value": "max(1,heal)"
              }
            },
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 437234579939012,
              "parameters": {
                "value": "heal"
              }
            }
          ],
          "sid": 373668074808875
        }
      ]
    },
    {
      "functionName": "HealSelf",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "objectUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 231043652519709
        },
        {
          "name": "objectType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 380946243336915
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 404102473602085,
      "children": [
        {
          "eventType": "variable",
          "name": "healAmount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 736473569056282
        },
        {
          "eventType": "variable",
          "name": "beforeHP",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 524543141231510
        },
        {
          "eventType": "variable",
          "name": "actorName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 539760818863694
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 972808839036615,
              "parameters": {
                "variable": "healAmount",
                "value": "Functions.HealCalc(objectUID)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 696579791748684,
              "parameters": {
                "variable": "LastHealed",
                "value": "healAmount"
              }
            }
          ],
          "sid": 692880938986654
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 995935901572538,
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
              "sid": 978032523524055,
              "parameters": {
                "variable": "healAmount",
                "value": "ceil(healAmount * ChainMultiplier)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 524084613273220,
              "parameters": {
                "variable": "ApplyChainToNextHeal",
                "value": "0"
              }
            }
          ],
          "sid": 936754767660606
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 744112495787972,
              "parameters": {
                "variable": "objectType",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 994987551368258,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Heroes",
                  "sid": 505904370692362,
                  "parameters": {
                    "unique-id": "objectUID"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 663564794647693,
                  "parameters": {
                    "variable": "actorName",
                    "value": "Heroes.name"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 949049689534945,
                  "parameters": {
                    "variable": "beforeHP",
                    "value": "PartyHP"
                  }
                }
              ],
              "sid": 681054371970949,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [],
                  "actions": [
                    {
                      "callFunction": "ApplyPartyHeal",
                      "sid": 873587094724966,
                      "parameters": [
                        "healAmount"
                      ]
                    },
                    {
                      "callFunction": "LogCombat",
                      "sid": 806239156923292,
                      "parameters": [
                        "actorName & \" healed party for \" & (PartyHP - beforeHP)"
                      ]
                    }
                  ],
                  "sid": 798942943199253
                }
              ]
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 336396352908979,
              "parameters": {
                "variable": "objectType",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [],
          "sid": 296393398247062,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Enemy_Sprite",
                  "sid": 682852941962326,
                  "parameters": {
                    "unique-id": "objectUID"
                  }
                }
              ],
              "actions": [],
              "sid": 616752207951261,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-instance-variable",
                      "objectClass": "Enemy_Sprite",
                      "sid": 855091035715656,
                      "parameters": {
                        "instance-variable": "HP",
                        "comparison": 2,
                        "value": "Enemy_Sprite.maxHP"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-instvar-value",
                      "objectClass": "Enemy_Sprite",
                      "sid": 184771456048204,
                      "parameters": {
                        "instance-variable": "HP",
                        "value": "min(Enemy_Sprite.maxHP,Enemy_Sprite.HP+healAmount)"
                      }
                    },
                    {
                      "callFunction": "Update_Bars",
                      "sid": 762082400719687
                    }
                  ],
                  "sid": 146810805239548
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "functionName": "ApplyPartyDamage",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 775618330598814
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 534816105145714,
          "parameters": {
            "variable": "PartyHP",
            "value": "max(0,PartyHP-damage)"
          }
        },
        {
          "callFunction": "SyncPartyHPToHeroes",
          "sid": 383965371202592
        },
        {
          "callFunction": "UpdateHeroHPUI",
          "sid": 778858723459389
        },
        {
          "callFunction": "UpdatePartyHPText",
          "sid": 895382624855841
        },
        {
          "callFunction": "UpdatePartyHPBar",
          "sid": 288234613511014
        }
      ],
      "sid": 672375698751536
    },
    {
      "functionName": "UpdatePartyHPBar",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-maximum",
          "objectClass": "PartyHP_Bar",
          "sid": 918631354227220,
          "parameters": {
            "maximum": "PartyMaxHP"
          }
        },
        {
          "id": "set-progress",
          "objectClass": "PartyHP_Bar",
          "sid": 433135486237914,
          "parameters": {
            "value": "PartyHP"
          }
        }
      ],
      "sid": 862066134765210
    },
    {
      "functionName": "GetChainMultiplier",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "chainNum",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 895519639113987
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 367752312630212,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 815793660383991,
              "parameters": {
                "variable": "chainNum",
                "comparison": 3,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 958341957412458,
              "parameters": {
                "value": "1.0"
              }
            }
          ],
          "sid": 207766030941049
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 375441175614230,
              "parameters": {
                "variable": "chainNum",
                "comparison": 0,
                "value": "2"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 953333483444011,
              "parameters": {
                "value": "1.2"
              }
            }
          ],
          "sid": 274354202036936
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 599415019338442,
              "parameters": {
                "variable": "chainNum",
                "comparison": 0,
                "value": "3"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 549147800660626,
              "parameters": {
                "value": "1.25"
              }
            }
          ],
          "sid": 523184721419936
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 515244737009896,
              "parameters": {
                "variable": "chainNum",
                "comparison": 0,
                "value": "4"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 339094484838441,
              "parameters": {
                "value": "1.3"
              }
            }
          ],
          "sid": 485009504203632
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 184399284429937,
              "parameters": {
                "variable": "chainNum",
                "comparison": 0,
                "value": "5"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 489212017832491,
              "parameters": {
                "value": "1.4"
              }
            }
          ],
          "sid": 490178831943195
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 891146587074942,
              "parameters": {
                "variable": "chainNum",
                "comparison": 0,
                "value": "6"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 353693335294571,
              "parameters": {
                "value": "1.5"
              }
            }
          ],
          "sid": 255115854591159
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 525600620876980,
              "parameters": {
                "variable": "chainNum",
                "comparison": 5,
                "value": "7"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 941980124952035,
              "parameters": {
                "value": "1.55"
              }
            }
          ],
          "sid": 388869782901359
        }
      ]
    },
    {
      "functionName": "UpdateChain",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "matchColor",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 826885813176091
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 916530699988731,
      "children": [
        {
          "eventType": "variable",
          "name": "newStreak",
          "type": "number",
          "initialValue": "1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 632406839498489
        },
        {
          "eventType": "variable",
          "name": "uiChain",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 170805871063498
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 222583788107894,
              "parameters": {
                "first-value": "matchColor",
                "comparison": 2,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 647999971497428,
              "parameters": {
                "variable": "ChainNumber",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 861656837830042,
              "parameters": {
                "variable": "ChainMultiplier",
                "value": "1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 575327683202370,
              "parameters": {
                "variable": "LastMatchColor",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 693507724548720,
              "parameters": {
                "variable": "ApplyChainToNextDamage",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 750828757186675,
              "parameters": {
                "variable": "ApplyChainToNextHeal",
                "value": "0"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "Chain_Tracker",
              "sid": 498263027163503,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-text",
              "objectClass": "Chain_Tracker",
              "sid": 790679464245997,
              "parameters": {
                "text": "\"\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 470695401835981,
              "parameters": {
                "variable": "ChainUIHideAt",
                "value": "0"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 687616712826335
            }
          ],
          "sid": 967472985667734
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 994944957154772,
              "parameters": {
                "first-value": "matchColor",
                "comparison": 4,
                "second-value": "2"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 176515982814034
            }
          ],
          "sid": 816863421870773
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 521323062949236,
              "parameters": {
                "first-value": "matchColor",
                "comparison": 0,
                "second-value": "LastMatchColor"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 376254109738000,
              "parameters": {
                "variable": "newStreak",
                "value": "ChainNumber+1"
              }
            }
          ],
          "sid": 432384017163774
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 593163586151678,
              "parameters": {
                "first-value": "matchColor",
                "comparison": 1,
                "second-value": "LastMatchColor"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 923313126938124,
              "parameters": {
                "variable": "newStreak",
                "value": "1"
              }
            }
          ],
          "sid": 540789265246588
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 221526986143733,
              "parameters": {
                "variable": "ChainNumber",
                "value": "newStreak"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 190910005548802,
              "parameters": {
                "variable": "ChainMultiplier",
                "value": "Functions.GetChainMultiplier(newStreak)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 545089950814553,
              "parameters": {
                "variable": "LastMatchColor",
                "value": "matchColor"
              }
            }
          ],
          "sid": 576612641866015
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 685861271394508,
              "parameters": {
                "variable": "uiChain",
                "value": "max(0,ChainNumber-1)"
              }
            }
          ],
          "sid": 242441277194465
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 794965115804800,
              "parameters": {
                "first-value": "uiChain",
                "comparison": 5,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 114364040417096,
              "parameters": {
                "variable": "SuppressChainUI",
                "value": "false"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "Chain_Tracker",
              "sid": 598182052670399,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-text",
              "objectClass": "Chain_Tracker",
              "sid": 604227715074537,
              "parameters": {
                "text": "\"Chain \" & uiChain & \"!\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 279254035899189,
              "parameters": {
                "variable": "ChainUIHideAt",
                "value": "(time + ChainUIDuration)"
              }
            }
          ],
          "sid": 876686004866223
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "else",
              "objectClass": "System",
              "sid": 658758519411026
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "Chain_Tracker",
              "sid": 612210698140480,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-text",
              "objectClass": "Chain_Tracker",
              "sid": 790106525455564,
              "parameters": {
                "text": "\"\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 236194776155422,
              "parameters": {
                "variable": "ChainUIHideAt",
                "value": "0"
              }
            }
          ],
          "sid": 236571325133862
        }
      ]
    },
    {
      "functionName": "InitPartyHPFromHeroes",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 543794682064344,
      "children": [
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 788728176124336,
              "parameters": {
                "variable": "PartyHP",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 619562642531521,
              "parameters": {
                "variable": "PartyMaxHP",
                "value": "0"
              }
            }
          ],
          "sid": 812748796085777,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for-each",
                  "objectClass": "System",
                  "sid": 898409271754186,
                  "parameters": {
                    "object": "Heroes"
                  }
                }
              ],
              "actions": [
                {
                  "id": "add-to-eventvar",
                  "objectClass": "System",
                  "sid": 580750665887045,
                  "parameters": {
                    "variable": "PartyMaxHP",
                    "value": "Heroes.HP"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 807741925838249,
                  "parameters": {
                    "variable": "PartyHP",
                    "value": "PartyMaxHP"
                  }
                },
                {
                  "callFunction": "UpdatePartyHPBar",
                  "sid": 636733270553369
                }
              ],
              "sid": 923959983279233
            }
          ]
        }
      ]
    },
    {
      "functionName": "SyncPartyHPToHeroes",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 956709214867736,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 820761649830161,
              "parameters": {
                "object": "Heroes"
              }
            }
          ],
          "actions": [
            {
              "id": "set-instvar-value",
              "objectClass": "Heroes",
              "sid": 771977529195689,
              "parameters": {
                "instance-variable": "maxHP",
                "value": "PartyMaxHP"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "Heroes",
              "sid": 594023030931986,
              "parameters": {
                "instance-variable": "HP",
                "value": "PartyHP"
              }
            }
          ],
          "sid": 809442527100699
        }
      ]
    },
    {
      "functionName": "UpdatePartyHPText",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-text",
          "objectClass": "PartyHP_text",
          "sid": 339085894573889,
          "parameters": {
            "text": "PartyHP & \" / \" & PartyMaxHP"
          }
        }
      ],
      "sid": 798374857819621
    },
    {
      "functionName": "ApplyChain",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "chainNum",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 430677896711573
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 563426157206127,
      "children": [
        {
          "eventType": "variable",
          "name": "uiChain",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 110797632325415
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 661290251509161,
              "parameters": {
                "variable": "uiChain",
                "value": "max(0,chainNum-1)"
              }
            }
          ],
          "sid": 815375620644509
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 276616905522835,
              "parameters": {
                "variable": "uiChain",
                "comparison": 5,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 289826219513571,
              "parameters": {
                "variable": "SuppressChainUI",
                "value": "false"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "Chain_Tracker",
              "sid": 432116246777425,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-text",
              "objectClass": "Chain_Tracker",
              "sid": 362062343832994,
              "parameters": {
                "text": "\"Chain \" & str(chainNum) & \"!\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 499582938373956,
              "parameters": {
                "variable": "ChainUIHideAt",
                "value": "(time+ChainUIDuration)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 876434926904041,
              "parameters": {
                "variable": "ApplyChainToNextDamage",
                "value": "1"
              }
            }
          ],
          "sid": 685390407119700
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "else",
              "objectClass": "System",
              "sid": 854449619436182
            }
          ],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "Chain_Tracker",
              "sid": 766637871798428,
              "parameters": {
                "text": "\"\""
              }
            },
            {
              "id": "set-visible",
              "objectClass": "Chain_Tracker",
              "sid": 439916068418012,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 388796084337465,
              "parameters": {
                "variable": "ChainUIHideAt",
                "value": "0"
              }
            }
          ],
          "sid": 837159180763672
        }
      ]
    },
    {
      "functionName": "FocusEnemyBar",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 614661224533711
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 752620908151476,
      "children": [
        {
          "eventType": "variable",
          "name": "lingerSec",
          "type": "number",
          "initialValue": "2",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 814104755984379
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 939611053977516,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [],
          "sid": 289187074312183,
          "children": [
            {
              "eventType": "block",
              "conditions": [],
              "actions": [],
              "sid": 428334671884381
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [],
          "sid": 129745655085152
        }
      ]
    },
    {
      "functionName": "RefreshSelectors",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 155298401852967,
      "children": [
        {
          "eventType": "variable",
          "name": "eUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 885542945203128
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "destroy",
              "objectClass": "Selector",
              "sid": 100479979004085
            }
          ],
          "sid": 627686716679190
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 723503764090446,
              "parameters": {
                "variable": "IsAOEMatch",
                "comparison": 0,
                "value": "1"
              }
            },
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 650130005809625,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 186855728016376,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 414093692106230,
              "parameters": {
                "variable": "eUID",
                "value": "Enemy_Sprite.UID"
              }
            },
            {
              "id": "create-object",
              "objectClass": "System",
              "sid": 715604921065248,
              "parameters": {
                "object-to-create": "Selector",
                "layer": "\"Attack_UI\"",
                "x": "Enemy_Sprite.X",
                "y": "Enemy_Sprite.BBoxTop-10",
                "create-hierarchy": false,
                "template-name": "\"\""
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "Selector",
              "sid": 296170931313638,
              "parameters": {
                "instance-variable": "ownerID",
                "value": "eUID"
              }
            }
          ],
          "sid": 128314792761802
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 725140191693265,
              "parameters": {
                "variable": "IsAOEMatch",
                "comparison": 0,
                "value": "0"
              }
            },
            {
              "id": "pick-by-comparison",
              "objectClass": "System",
              "sid": 842007412068974,
              "parameters": {
                "object": "Enemy_Sprite",
                "expression": "Enemy_Sprite.IsSelected",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 457777871080387,
              "parameters": {
                "variable": "eUID",
                "value": "Enemy_Sprite.UID"
              }
            },
            {
              "id": "create-object",
              "objectClass": "System",
              "sid": 437434558404806,
              "parameters": {
                "object-to-create": "Selector",
                "layer": "\"Attack_UI\"",
                "x": "Enemy_Sprite.X",
                "y": "Enemy_Sprite.BBoxTop-10",
                "create-hierarchy": false,
                "template-name": "\"\""
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "Selector",
              "sid": 585942318495542,
              "parameters": {
                "instance-variable": "ownerID",
                "value": "eUID"
              }
            }
          ],
          "sid": 462336852231553
        }
      ]
    },
    {
      "functionName": "ExecuteSkill",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "skillId",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "sid": 344270973390786
        },
        {
          "name": "actorUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 178244140787163
        },
        {
          "name": "actorType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 836884522054886
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-eventvar-value",
          "objectClass": "System",
          "sid": 925166935417032,
          "parameters": {
            "variable": "IsAOEMatch",
            "value": "0"
          }
        }
      ],
      "sid": 256959948443811,
      "children": [
        {
          "eventType": "variable",
          "name": "selUID",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 597869407861114
        },
        {
          "eventType": "variable",
          "name": "handled",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 830651202324530
        },
        {
          "eventType": "variable",
          "name": "actorName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 295298665590396
        },
        {
          "eventType": "variable",
          "name": "buffName",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 546230160943982
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 645380388125777,
              "parameters": {
                "variable": "selUID",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 732164785454590,
              "parameters": {
                "variable": "handled",
                "value": "0"
              }
            }
          ],
          "sid": 199550193674808
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 759912073144647,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 545084536134594,
              "parameters": {
                "variable": "actorName",
                "value": "Heroes.name"
              }
            }
          ],
          "sid": 580140693824373
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 371316730145378,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"DEF_UP\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 340593115211071,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Party_DEF_UP",
              "sid": 485947833018893,
              "parameters": [
                "51",
                "2"
              ]
            },
            {
              "id": "set-text",
              "objectClass": "BuffText",
              "sid": 545213988055895,
              "parameters": {
                "text": "\"BUFF DEF=\" & PartyBuff_DEF  & \"/\" & PartyBuffCap_DEF"
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 234219781859662,
              "parameters": [
                "actorName & \" increased the party's defense!\""
              ]
            }
          ],
          "sid": 649668501015810
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 616112765046267,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"ATK_UP\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 624014676015950,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Party_ATK_UP",
              "sid": 391430939289376,
              "parameters": [
                "51",
                "2"
              ]
            },
            {
              "id": "set-text",
              "objectClass": "BuffText",
              "sid": 678810261360519,
              "parameters": {
                "text": "\"BUFF ATK=\" & PartyBuff_ATK  & \"/\" & PartyBuffCap_ATK"
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 498303475660463,
              "parameters": [
                "actorName & \" increased the party's atttack!\""
              ]
            }
          ],
          "sid": 509785264830705
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 332636038156005,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"MAG_UP\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 208297472733967,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Party_MAG_UP",
              "sid": 984762765977160,
              "parameters": [
                "51",
                "2"
              ]
            },
            {
              "id": "set-text",
              "objectClass": "BuffText",
              "sid": 815856037565014,
              "parameters": {
                "text": "\"BUFF MAG=\" & PartyBuff_MAG  & \"/\" & PartyBuffCap_MAG"
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 149069267872959,
              "parameters": [
                "actorName & \" increased the party's magic attack!\""
              ]
            }
          ],
          "sid": 385202233055302
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 247657280171389,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"SPD_UP\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 434016393921224,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Party_SPD_UP",
              "sid": 531517417543020,
              "parameters": [
                "51",
                "2"
              ]
            },
            {
              "id": "set-text",
              "objectClass": "BuffText",
              "sid": 913847842262739,
              "parameters": {
                "text": "\"BUFF SPD=\" & PartyBuff_SPD  & \"/\" & PartyBuffCap_SPD"
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 708103254098934,
              "parameters": [
                "actorName & \" increased the party's speed!\""
              ]
            }
          ],
          "sid": 349354013367770
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 950768371363066,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"RES_UP\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 561888244673433,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Party_RES_UP",
              "sid": 496356907493159,
              "parameters": [
                "51",
                "2"
              ]
            },
            {
              "id": "set-text",
              "objectClass": "BuffText",
              "sid": 967763244975543,
              "parameters": {
                "text": "\"BUFF RES=\" & PartyBuff_RES  & \"/\" & PartyBuffCap_RES"
              }
            },
            {
              "callFunction": "LogCombat",
              "sid": 287688101363651,
              "parameters": [
                "actorName & \" increased the party's magic defense!\""
              ]
            }
          ],
          "sid": 476564013058309
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 850174398069935,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"HERO_SINGLE\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 894179994490568,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "HeroAttackSingle",
              "sid": 232766472148300,
              "parameters": [
                "actorUID"
              ]
            }
          ],
          "sid": 466754169183674
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 870268419059147,
              "parameters": {
                "first-value": "skillId",
                "comparison": 0,
                "second-value": "\"HERO_AOE\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 828213994843363,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "HeroAttackAOE",
              "sid": 828550291032706,
              "parameters": [
                "actorUID"
              ]
            }
          ],
          "sid": 769335459896605
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-comparison",
              "objectClass": "System",
              "sid": 803497553551077,
              "parameters": {
                "object": "Enemy_Sprite",
                "expression": "Enemy_Sprite.IsSelected",
                "comparison": 0,
                "value": "1"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 858128529698772,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 439486904975917,
              "parameters": {
                "variable": "selUID",
                "value": "Enemy_Sprite.UID"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 458001941508922
            }
          ],
          "sid": 727694530167851,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 959238420782638,
                  "parameters": {
                    "first-value": "skillId",
                    "comparison": 0,
                    "second-value": "\"Enemy_ATK_Single\""
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 860874000449885,
                  "parameters": {
                    "variable": "handled",
                    "value": "1"
                  }
                }
              ],
              "sid": 594576152518193
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 267632769160535,
                  "parameters": {
                    "first-value": "skillId",
                    "comparison": 0,
                    "second-value": "\"Enemy_MAG_Single\""
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 479404422418594,
                  "parameters": {
                    "variable": "handled",
                    "value": "1"
                  }
                }
              ],
              "sid": 832338686875606
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 617374676533713,
                  "parameters": {
                    "first-value": "skillId",
                    "comparison": 0,
                    "second-value": "\"Enemy_MAG_AOE\""
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 212525925927050,
                  "parameters": {
                    "variable": "handled",
                    "value": "1"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 762442342378482,
                  "parameters": {
                    "variable": "IsAOEMatch",
                    "value": "1"
                  }
                }
              ],
              "sid": 367595232828490
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 863410454634381,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "LogCombat",
              "sid": 989844883673247,
              "parameters": [
                "actorName & \" tried skill: \" & skillId & \" (UNKNOWN)\""
              ]
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 184250677321473
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 602918406619926
            }
          ],
          "sid": 506407761999325
        }
      ]
    },
    {
      "functionName": "ResolveGemAction",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "gemColor",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 346248739259020
        },
        {
          "name": "actorUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 628691537593054
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 444811195249313,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 754661393806755,
              "parameters": {
                "first-value": "gemColor",
                "comparison": 0,
                "second-value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 872491960546496,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 858956665339605,
              "parameters": {
                "variable": "PendingSkillID",
                "value": "\"HERO_AOE\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 620701897592920,
              "parameters": {
                "variable": "PendingActor",
                "value": "actorUID"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 318569880354107,
              "parameters": {
                "variable": "IsAOEMatch",
                "value": "1"
              }
            },
            {
              "callFunction": "LogGemIntent",
              "sid": 716684847553038,
              "parameters": [
                "0",
                "\"GREEN\"",
                "\"HERO_AOE\"",
                "\"\"",
                "actorUID"
              ]
            },
            {
              "callFunction": "ShowAttackUI",
              "sid": 257794909667509
            }
          ],
          "sid": 672467090662522
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 877961059204836,
              "parameters": {
                "first-value": "gemColor",
                "comparison": 0,
                "second-value": "1"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 217194400674334,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 919831983057994,
              "parameters": {
                "variable": "PendingSkillID",
                "value": "\"HERO_SINGLE\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 524425705854911,
              "parameters": {
                "variable": "PendingActor",
                "value": "actorUID"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 840692165213407,
              "parameters": {
                "variable": "IsAOEMatch",
                "value": "0"
              }
            },
            {
              "callFunction": "LogGemIntent",
              "sid": 519435641331282,
              "parameters": [
                "1",
                "\"RED\"",
                "\"HERO_SINGLE\"",
                "\"\"",
                "actorUID"
              ]
            },
            {
              "callFunction": "ShowAttackUI",
              "sid": 723036223900609
            }
          ],
          "sid": 751557651612954
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 932234738466889,
              "parameters": {
                "first-value": "gemColor",
                "comparison": 0,
                "second-value": "2"
              }
            }
          ],
          "actions": [],
          "sid": 593467906048319,
          "children": [
            {
              "eventType": "variable",
              "name": "intentKey",
              "type": "string",
              "initialValue": "\"\"",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 122037957136945
            },
            {
              "eventType": "variable",
              "name": "roll",
              "type": "number",
              "initialValue": "0",
              "comment": "",
              "isStatic": false,
              "isConstant": false,
              "sid": 285263866115372
            },
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 444003457070990,
                  "parameters": {
                    "variable": "PendingActor",
                    "value": "actorUID"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 941255451608378,
                  "parameters": {
                    "variable": "IsAOEMatch",
                    "value": "0"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 807739761848293,
                  "parameters": {
                    "variable": "roll",
                    "value": "floor(random(5))"
                  }
                }
              ],
              "sid": 826809787251004
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 951138581388113,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 0,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 842542232095638,
                  "parameters": {
                    "variable": "PendingSkillID",
                    "value": "\"DEF_UP\""
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 801571738946580,
                  "parameters": {
                    "variable": "intentKey",
                    "value": "\"Party_DEF_UP\""
                  }
                }
              ],
              "sid": 807116006534453
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 285304855128196,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 0,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 785164809187168,
                  "parameters": {
                    "variable": "PendingSkillID",
                    "value": "\"ATK_UP\""
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 419636037786894,
                  "parameters": {
                    "variable": "intentKey",
                    "value": "\"Party_ATK_UP\""
                  }
                }
              ],
              "sid": 905607641460292
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 365203594384788,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 0,
                    "second-value": "2"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 533533678007983,
                  "parameters": {
                    "variable": "PendingSkillID",
                    "value": "\"MAG_UP\""
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 619311194921117,
                  "parameters": {
                    "variable": "intentKey",
                    "value": "\"Party_MAG_UP\""
                  }
                }
              ],
              "sid": 478260630514828
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 856718852593146,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 0,
                    "second-value": "3"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 865067450146082,
                  "parameters": {
                    "variable": "PendingSkillID",
                    "value": "\"SPD_UP\""
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 302841351812509,
                  "parameters": {
                    "variable": "intentKey",
                    "value": "\"Party_SPD_UP\""
                  }
                }
              ],
              "sid": 965164266468978
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 157324566411658,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 0,
                    "second-value": "4"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 152621866224604,
                  "parameters": {
                    "variable": "PendingSkillID",
                    "value": "\"RES_UP\""
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 608706505817564,
                  "parameters": {
                    "variable": "intentKey",
                    "value": "\"Party_RES_UP\""
                  }
                }
              ],
              "sid": 938737880179439
            },
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "callFunction": "LogGemIntent",
                  "sid": 198274003500800,
                  "parameters": [
                    "2",
                    "\"BLUE\"",
                    "intentKey",
                    "\"\"",
                    "actorUID"
                  ]
                },
                {
                  "callFunction": "StartBuffRoll",
                  "sid": 723754221744813,
                  "parameters": [
                    "roll",
                    "actorUID"
                  ]
                }
              ],
              "sid": 773576193870110
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 715269146569542,
              "parameters": {
                "first-value": "gemColor",
                "comparison": 0,
                "second-value": "3"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 964855296414640,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "LogGemIntent",
              "sid": 367399065351662,
              "parameters": [
                "3",
                "\"GOLD\"",
                "\"Add_Gold\"",
                "\"hero-routing\"",
                "actorUID"
              ]
            },
            {
              "callFunction": "Add_Gold",
              "sid": 473045867225760,
              "parameters": [
                "random(1,45)"
              ]
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 486448283015051
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 237145348331433
            }
          ],
          "sid": 617254410917182
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 900283604835968,
              "parameters": {
                "first-value": "gemColor",
                "comparison": 0,
                "second-value": "4"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 224058620879921,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "LogGemIntent",
              "sid": 404065915127332,
              "parameters": [
                "4",
                "\"LIGHTGREEN\"",
                "\"Do_Heal\"",
                "\"\"",
                "actorUID"
              ]
            },
            {
              "callFunction": "DoHeal",
              "sid": 424607169114437,
              "parameters": [
                "actorUID"
              ]
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 291236715621131
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 630374791019210
            }
          ],
          "sid": 666075203158033
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 404000967142285,
              "parameters": {
                "first-value": "gemColor",
                "comparison": 0,
                "second-value": "5"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 779336271535744,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "LogGemIntent",
              "sid": 201493440177126,
              "parameters": [
                "5",
                "\"PURPLE\"",
                "\"Add_Energy\"",
                "\"hero-routing\"",
                "actorUID"
              ]
            },
            {
              "callFunction": "Add_Energy",
              "sid": 444857337487562,
              "parameters": [
                "actorUID"
              ]
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 776597488960376
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 699979377521596
            }
          ],
          "sid": 352644481419043
        }
      ]
    },
    {
      "functionName": "ApplyDamage",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "targetUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 967809579819816
        },
        {
          "name": "amount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 852014774535795
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 746307654979416,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 295570917152659,
              "parameters": {
                "unique-id": "targetUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-instvar-value",
              "objectClass": "Enemy_Sprite",
              "sid": 156559563469057,
              "parameters": {
                "instance-variable": "HP",
                "value": "max(0,Enemy_Sprite.HP-amount)"
              }
            },
            {
              "callFunction": "Update_Bars",
              "sid": 954442670101618
            }
          ],
          "sid": 335072002365928
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 596112410928018,
              "parameters": {
                "unique-id": "targetUID"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 618091945314347,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 3,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "KillEnemyAt",
              "sid": 153405717812396,
              "parameters": [
                "Enemy_Sprite.slotIndex"
              ]
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 530359124298542
            }
          ],
          "sid": 288236962512883
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 815254321383455,
              "parameters": {
                "unique-id": "targetUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 850111086913885,
              "parameters": {
                "variable": "PartyHP",
                "value": "max(0,PartyHP-amount)"
              }
            },
            {
              "callFunction": "SyncPartyHPToHeroes",
              "sid": 390979035832500
            },
            {
              "callFunction": "UpdateHeroHPUI",
              "sid": 451517854623652
            },
            {
              "callFunction": "UpdatePartyHPText",
              "sid": 855439162486347
            },
            {
              "callFunction": "UpdatePartyHPBar",
              "sid": 916070413637996
            }
          ],
          "sid": 371382033737035
        }
      ]
    },
    {
      "functionName": "LogGemIntent",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "frame",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 359515122206244
        },
        {
          "name": "colorName",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "sid": 238985220557337
        },
        {
          "name": "intentKey",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "sid": 818988841364382
        },
        {
          "name": "extra",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "sid": 529209651263100
        },
        {
          "name": "actorUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 549659996965475
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 839413164420184,
      "children": [
        {
          "eventType": "variable",
          "name": "whoName",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 551895561191605
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-comparison",
              "objectClass": "System",
              "sid": 897337708516427,
              "parameters": {
                "object": "Heroes",
                "expression": "Heroes.UID",
                "comparison": 0,
                "value": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 268827726190326,
              "parameters": {
                "variable": "whoName",
                "value": "Heroes.name"
              }
            }
          ],
          "sid": 686582267227268
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "ActorIntent",
              "sid": 416519861549402,
              "parameters": {
                "text": "\"[GEM f\" & frame & \" \" & colorName & \"] \" & whoName & \" -> \" & intentKey & (len(extra)>0 ? \" (\" & extra & \")\" : \"\")"
              }
            }
          ],
          "sid": 471008619214912
        }
      ]
    },
    {
      "functionName": "ClearAllBuffs",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 787820613835730,
      "children": [
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 605618865698676,
              "parameters": {
                "variable": "PartyBuff_ATK",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 383090008767174,
              "parameters": {
                "variable": "PartyBuff_RES",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 531351455847147,
              "parameters": {
                "variable": "PartyBuff_DEF",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 254970144312968,
              "parameters": {
                "variable": "PartyBuff_MAG",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 670008176643225,
              "parameters": {
                "variable": "PartyBuff_SPD",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 467108579396234,
              "parameters": {
                "variable": "BuffCasterUID_DEF",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 135304735177814,
              "parameters": {
                "variable": "BuffExpire_DEF",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 138060542745006,
              "parameters": {
                "variable": "BuffCasterUID_RES",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 318073749712462,
              "parameters": {
                "variable": "BuffExpire_RES",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 559330221835263,
              "parameters": {
                "variable": "BuffCasterUID_SPD",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 188312953643362,
              "parameters": {
                "variable": "BuffExpire_SPD",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 203323117663316,
              "parameters": {
                "variable": "BuffCasterUID_MAG",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 892683697885589,
              "parameters": {
                "variable": "BuffExpire_MAG",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 785286886559261,
              "parameters": {
                "variable": "BuffCasterUID_ATK",
                "value": "-1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 902599107329326,
              "parameters": {
                "variable": "BuffExpire_ATK",
                "value": "-1"
              }
            }
          ],
          "sid": 674879020573715
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 144460257624652
            }
          ],
          "sid": 319648439264888
        }
      ]
    },
    {
      "functionName": "RefreshPartyBuffUI",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [
        {
          "id": "set-text",
          "objectClass": "newdebugger",
          "sid": 980339195046292,
          "parameters": {
            "text": "\"UI refresh: =\" & TrackBuffs.At(0,0,0) &\n        \" =\" & TrackBuffs.At(1,0,0) &\n        \" =\" & TrackBuffs.At(2,0,0) &\n        \" =\" & TrackBuffs.At(3,0,0) &\n        \" =\" & TrackBuffs.At(4,0,0)"
          }
        }
      ],
      "sid": 593991874496285,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 738073875674328,
              "parameters": {
                "variable": "BuffRollActive",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 474542710679039
            }
          ],
          "sid": 905494577201432
        },
        {
          "eventType": "variable",
          "name": "v",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 768658662141269
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "buffIcon1",
              "sid": 200410989398621,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon2",
              "sid": 226272766407156,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon3",
              "sid": 638975915901617,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon4",
              "sid": 827091435941020,
              "parameters": {
                "visibility": "invisible"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon5",
              "sid": 142108606524801,
              "parameters": {
                "visibility": "invisible"
              }
            }
          ],
          "sid": 831131950890931
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 900619698479551,
              "parameters": {
                "first-value": "TrackBuffs.At(0,0,0)",
                "comparison": 5,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 920390056972367,
              "parameters": {
                "variable": "v",
                "value": "TrackBuffs.At(0,0,0)"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon1",
              "sid": 246511381658720,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon1",
              "sid": 496079172499706,
              "parameters": {
                "frame-number": "v"
              }
            }
          ],
          "sid": 516814946039469
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 864809546410221,
              "parameters": {
                "first-value": "TrackBuffs.At(1,0,0)",
                "comparison": 5,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 369892189961933,
              "parameters": {
                "variable": "v",
                "value": "TrackBuffs.At(1,0,0)"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon2",
              "sid": 683165808599608,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon2",
              "sid": 320690908855275,
              "parameters": {
                "frame-number": "v"
              }
            }
          ],
          "sid": 325784748679957
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 277943236984860,
              "parameters": {
                "first-value": "TrackBuffs.At(2,0,0)",
                "comparison": 5,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 128282653378064,
              "parameters": {
                "variable": "v",
                "value": "TrackBuffs.At(2,0,0)"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon3",
              "sid": 682410885517497,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon3",
              "sid": 644646659743765,
              "parameters": {
                "frame-number": "v"
              }
            }
          ],
          "sid": 997828049094474
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 259842344127724,
              "parameters": {
                "first-value": "TrackBuffs.At(3,0,0)",
                "comparison": 5,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 713470381476788,
              "parameters": {
                "variable": "v",
                "value": "TrackBuffs.At(3,0,0)"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon4",
              "sid": 950852357240790,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon4",
              "sid": 432634883317234,
              "parameters": {
                "frame-number": "v"
              }
            }
          ],
          "sid": 749571941923520
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 585861607757431,
              "parameters": {
                "first-value": "TrackBuffs.At(4,0,0)",
                "comparison": 5,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 942285194495388,
              "parameters": {
                "variable": "v",
                "value": "TrackBuffs.At(4,0,0)"
              }
            },
            {
              "id": "set-visible",
              "objectClass": "buffIcon5",
              "sid": 713899239532509,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon5",
              "sid": 194703675529636,
              "parameters": {
                "frame-number": "v"
              }
            }
          ],
          "sid": 621422398383277
        }
      ]
    },
    {
      "functionName": "RegisterPartyBuffSlot",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "buffType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 548264032089592
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 366906951501580,
      "children": [
        {
          "eventType": "variable",
          "name": "found",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 600758098792410
        },
        {
          "eventType": "variable",
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 132419408160314
        },
        {
          "eventType": "variable",
          "name": "oldW",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 734865387363708
        },
        {
          "eventType": "variable",
          "name": "v",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 725112295720746
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 844268016992337,
              "parameters": {
                "first-value": "buffType",
                "comparison": 2,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 300304350542618
            }
          ],
          "sid": 902212920775342
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 877672856482334,
              "parameters": {
                "first-value": "buffType",
                "comparison": 4,
                "second-value": "4"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 278459999903323
            }
          ],
          "sid": 602038732953231
        },
        {
          "eventType": "comment",
          "text": "// Ensure TrackBuffs is sized and only initialize NEW cells"
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 648751983698041,
              "parameters": {
                "variable": "oldW",
                "value": "TrackBuffs.Width"
              }
            },
            {
              "id": "set-size",
              "objectClass": "TrackBuffs",
              "sid": 381734147724971,
              "parameters": {
                "width": "5",
                "height": "1",
                "depth": "1"
              }
            }
          ],
          "sid": 411172737242662
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 937784496319211,
              "parameters": {
                "first-value": "oldW",
                "comparison": 2,
                "second-value": "5"
              }
            }
          ],
          "actions": [],
          "sid": 620342108536763,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 969259346028276,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "oldW",
                    "end-index": "4"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-at-xyz",
                  "objectClass": "TrackBuffs",
                  "sid": 369028069857466,
                  "parameters": {
                    "x": "loopindex(\"i\")",
                    "y": "0",
                    "z": "0",
                    "value": "-1"
                  }
                }
              ],
              "sid": 804423885044420
            }
          ]
        },
        {
          "eventType": "comment",
          "text": " // If already present, do nothing"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 719739690065886,
              "parameters": {
                "first-value": "found",
                "comparison": 0,
                "second-value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 580692694014239,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 290803455530919,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "0",
                    "end-index": "4"
                  }
                }
              ],
              "actions": [],
              "sid": 489164401315236,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 368919510091009,
                      "parameters": {
                        "first-value": "TrackBuffs.At(loopindex(\"i\"),0,0)",
                        "comparison": 0,
                        "second-value": "buffType"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 123485090831540,
                      "parameters": {
                        "variable": "found",
                        "value": "1"
                      }
                    },
                    {
                      "id": "stop-loop",
                      "objectClass": "System",
                      "sid": 749901075809908
                    }
                  ],
                  "sid": 252906384667303
                }
              ]
            }
          ]
        },
        {
          "eventType": "comment",
          "text": "// Find first empty slot"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 815682567133702,
              "parameters": {
                "first-value": "found",
                "comparison": 0,
                "second-value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 798861834064832,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 333450650054990,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "0",
                    "end-index": "4"
                  }
                }
              ],
              "actions": [],
              "sid": 213504888911199,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 984763062994114,
                      "parameters": {
                        "first-value": "TrackBuffs.At(loopindex(\"i\"),0,0)",
                        "comparison": 0,
                        "second-value": "-1"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-at-xyz",
                      "objectClass": "TrackBuffs",
                      "sid": 797541650306061,
                      "parameters": {
                        "x": "loopindex(\"i\")",
                        "y": "0",
                        "z": "0",
                        "value": "buffType"
                      }
                    },
                    {
                      "id": "set-eventvar-value",
                      "objectClass": "System",
                      "sid": 504110507072830,
                      "parameters": {
                        "variable": "found",
                        "value": "1"
                      }
                    },
                    {
                      "id": "stop-loop",
                      "objectClass": "System",
                      "sid": 553948806644805
                    }
                  ],
                  "sid": 933626820422138
                }
              ]
            }
          ]
        },
        {
          "eventType": "comment",
          "text": "// If full, shift-left and append newest"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 129347761187384,
              "parameters": {
                "first-value": "found",
                "comparison": 0,
                "second-value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 146428321950782,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 731773594455920,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "0",
                    "end-index": "3"
                  }
                }
              ],
              "actions": [],
              "sid": 293381424359434,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "compare-two-values",
                      "objectClass": "System",
                      "sid": 885911274706598,
                      "parameters": {
                        "first-value": "v",
                        "comparison": 0,
                        "second-value": "TrackBuffs.At(loopindex(\"i\")+1,0,0)"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-at-xyz",
                      "objectClass": "TrackBuffs",
                      "sid": 237095395595458,
                      "parameters": {
                        "x": "loopindex(\"i\")",
                        "y": "0",
                        "z": "0",
                        "value": "v"
                      }
                    }
                  ],
                  "sid": 202869554739200
                },
                {
                  "eventType": "block",
                  "conditions": [],
                  "actions": [
                    {
                      "id": "set-at-xyz",
                      "objectClass": "TrackBuffs",
                      "sid": 132770087264805,
                      "parameters": {
                        "x": "4",
                        "y": "0",
                        "z": "0",
                        "value": "buffType"
                      }
                    }
                  ],
                  "sid": 976909313526078
                }
              ]
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "newdebugger2",
              "sid": 487608185075359,
              "parameters": {
                "text": "\"TrackBuffs=\" &\n        TrackBuffs.At(0,0,0) & \",\" &\n        TrackBuffs.At(1,0,0) & \",\" &\n        TrackBuffs.At(2,0,0) & \",\" &\n        TrackBuffs.At(3,0,0) & \",\" &\n        TrackBuffs.At(4,0,0)"
              }
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 973175170839691
            }
          ],
          "sid": 633182184861292
        }
      ]
    },
    {
      "functionName": "RemovePartyBuffSlot",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "buffType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 548107210798295
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 768305606224016,
      "children": [
        {
          "eventType": "variable",
          "name": "didRemove",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 826060405643857
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 495049250453699,
              "parameters": {
                "first-value": "buffType",
                "comparison": 2,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 820697021377431
            }
          ],
          "sid": 924691480109886
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 209312567748983,
              "parameters": {
                "first-value": "buffType",
                "comparison": 4,
                "second-value": "4"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 739161295905525
            }
          ],
          "sid": 568324652497886
        },
        {
          "eventType": "comment",
          "text": "//REMOVE: clear matching slot (should exist at most once)"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 646060742117248,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "TrackBuffs.Width-1"
              }
            }
          ],
          "actions": [],
          "sid": 874468651094379,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 873115026091386,
                  "parameters": {
                    "first-value": "TrackBuffs.At(loopindex(\"i\"),0,0)",
                    "comparison": 0,
                    "second-value": "buffType"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-at-xyz",
                  "objectClass": "TrackBuffs",
                  "sid": 939183138003279,
                  "parameters": {
                    "x": "loopindex(\"i\")",
                    "y": "0",
                    "z": "0",
                    "value": "-1"
                  }
                },
                {
                  "id": "stop-loop",
                  "objectClass": "System",
                  "sid": 844024400328949
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 101305759332991,
                  "parameters": {
                    "variable": "didRemove",
                    "value": "1"
                  }
                }
              ],
              "sid": 394776655292230
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 644885054362205,
              "parameters": {
                "first-value": "didRemove",
                "comparison": 0,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "CompactPartyBuffSlot",
              "sid": 695620871228187
            },
            {
              "callFunction": "RefreshPartyBuffUI",
              "sid": 369073954897981
            }
          ],
          "sid": 145853480730570
        }
      ]
    },
    {
      "functionName": "CompactPartyBuffSlot",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 327944313010052,
      "children": [
        {
          "eventType": "variable",
          "name": "v",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 111876024306491
        },
        {
          "eventType": "variable",
          "name": "write",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 563898041539078
        },
        {
          "eventType": "comment",
          "text": "// Pack non -1 left, preserving order"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 585950896723130,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "TrackBuffs.Width-1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 942090528803762,
              "parameters": {
                "variable": "v",
                "value": "TrackBuffs.At(loopindex(\"i\"),0,0)"
              }
            }
          ],
          "sid": 872842933941903,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 601328898246459,
                  "parameters": {
                    "first-value": "v",
                    "comparison": 1,
                    "second-value": "-1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-at-xyz",
                  "objectClass": "TrackBuffs",
                  "sid": 817887441374373,
                  "parameters": {
                    "x": "write",
                    "y": "0",
                    "z": "0",
                    "value": "v"
                  }
                },
                {
                  "id": "add-to-eventvar",
                  "objectClass": "System",
                  "sid": 183015848756237,
                  "parameters": {
                    "variable": "write",
                    "value": "1"
                  }
                }
              ],
              "sid": 454738550465683
            }
          ]
        },
        {
          "eventType": "comment",
          "text": "// Clear remaining slots to -1"
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 410552260346671,
              "parameters": {
                "name": "\"i\"",
                "start-index": "write",
                "end-index": "TrackBuffs.Width-1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-at-xyz",
              "objectClass": "TrackBuffs",
              "sid": 413221102399242,
              "parameters": {
                "x": "loopindex(\"i\")",
                "y": "0",
                "z": "0",
                "value": "-1"
              }
            }
          ],
          "sid": 161410545250729
        }
      ]
    },
    {
      "functionName": "HeroAttackSingle",
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
          "sid": 315511115171383
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 846675753859966,
      "children": [
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 804031915405231
        },
        {
          "eventType": "variable",
          "name": "targetUID",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 550172324093350
        },
        {
          "eventType": "variable",
          "name": "actorName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 305667767103498
        },
        {
          "eventType": "variable",
          "name": "targetName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 554774627939555
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 485611529942248,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 230479714583845,
              "parameters": {
                "variable": "actorName",
                "value": "Heroes.name"
              }
            }
          ],
          "sid": 387270417775220
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-comparison",
              "objectClass": "System",
              "sid": 240793705869326,
              "parameters": {
                "object": "Enemy_Sprite",
                "expression": "Enemy_Sprite.IsSelected",
                "comparison": 0,
                "value": "1"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 295886620939048,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 190937038803721,
              "parameters": {
                "variable": "targetUID",
                "value": "Enemy_Sprite.UID"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 976083728690998,
              "parameters": {
                "variable": "targetName",
                "value": "Enemy_Sprite.name"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 579913846246733
            }
          ],
          "sid": 326204286003303
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 946414693685766,
              "parameters": {
                "first-value": "targetUID",
                "comparison": 2,
                "second-value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "AdvanceTurn",
              "sid": 743398011358769
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 986600878813113
            },
            {
              "callFunction": "LogCombat",
              "sid": 814506142641245,
              "parameters": [
                "actorName & \" had no target\""
              ]
            }
          ],
          "sid": 595799262036557
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 848371081460616,
              "parameters": {
                "unique-id": "actorUID"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 526089262948845,
              "parameters": {
                "first-value": "Heroes.heroIndex",
                "comparison": 3,
                "second-value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 731203171627902,
              "parameters": {
                "variable": "damage",
                "value": "Functions.MeleeCalc(actorUID, targetUID)"
              }
            }
          ],
          "sid": 639643638344893
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 535914508557681,
              "parameters": {
                "unique-id": "actorUID"
              }
            },
            {
              "id": "compare-two-values",
              "objectClass": "System",
              "sid": 956381342244466,
              "parameters": {
                "first-value": "Heroes.heroIndex",
                "comparison": 5,
                "second-value": "2"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 153943897680815,
              "parameters": {
                "variable": "damage",
                "value": "Functions.MagicCalc(actorUID, targetUID)"
              }
            }
          ],
          "sid": 388348280639358
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 888374907787994,
              "parameters": {
                "variable": "ApplyChainToNextDamage",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 619978072432960,
              "parameters": {
                "variable": "damage",
                "value": "ceil(damage * ChainMultiplier)"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 917469456131548,
              "parameters": {
                "variable": "ApplyChainToNextDamage",
                "value": "0"
              }
            }
          ],
          "sid": 332980245010616
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "ApplyDamage",
              "sid": 625047475341943,
              "parameters": [
                "targetUID",
                "damage"
              ]
            },
            {
              "callFunction": "LogCombat",
              "sid": 183084955371149,
              "parameters": [
                "actorName & \" hit \" & targetName & \" for \" & damage &\"!\""
              ]
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 881568933065752
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 200001487200162
            }
          ],
          "sid": 709902123905196
        }
      ]
    },
    {
      "functionName": "HeroAttackAOE",
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
          "sid": 258537840601468
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 186574282339345,
      "children": [
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 362054828040809
        },
        {
          "eventType": "variable",
          "name": "totalDamage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 153641547084879
        },
        {
          "eventType": "variable",
          "name": "actorName",
          "type": "string",
          "initialValue": "\"?\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 791686765149167
        },
        {
          "eventType": "variable",
          "name": "aoeName",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 403284223673396
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 875936255745824,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 961379254523009,
              "parameters": {
                "variable": "actorName",
                "value": "Heroes.name"
              }
            }
          ],
          "sid": 269843607272707
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 977218667201659,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 261385306643304,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 322174906392430,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Heroes",
                  "sid": 895187177446480,
                  "parameters": {
                    "unique-id": "actorUID"
                  }
                },
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 710402284593642,
                  "parameters": {
                    "first-value": "Heroes.heroIndex",
                    "comparison": 3,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 420817047197329,
                  "parameters": {
                    "variable": "damage",
                    "value": "Functions.MeleeCalc(actorUID, Enemy_Sprite.UID)"
                  }
                }
              ],
              "sid": 391459419346639
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Heroes",
                  "sid": 489444580121033,
                  "parameters": {
                    "unique-id": "actorUID"
                  }
                },
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 750319013584139,
                  "parameters": {
                    "first-value": "Heroes.heroIndex",
                    "comparison": 5,
                    "second-value": "2"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 391450281443701,
                  "parameters": {
                    "variable": "damage",
                    "value": "Functions.MagicCalc(actorUID, Enemy_Sprite.UID)"
                  }
                }
              ],
              "sid": 716028702775914
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-eventvar",
                  "objectClass": "System",
                  "sid": 730054736630014,
                  "parameters": {
                    "variable": "ApplyChainToNextDamage",
                    "comparison": 0,
                    "value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 771097435888702,
                  "parameters": {
                    "variable": "damage",
                    "value": "ceil(damage * ChainMultiplier)"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 345420033720636,
                  "parameters": {
                    "variable": "ApplyChainToNextDamage",
                    "value": "0"
                  }
                }
              ],
              "sid": 564083612898681
            },
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "id": "set-instvar-value",
                  "objectClass": "Enemy_Sprite",
                  "sid": 648045011789838,
                  "parameters": {
                    "instance-variable": "HP",
                    "value": "max(0, Enemy_Sprite.HP - damage)"
                  }
                },
                {
                  "id": "add-to-eventvar",
                  "objectClass": "System",
                  "sid": 339276145159672,
                  "parameters": {
                    "variable": "totalDamage",
                    "value": "damage"
                  }
                },
                {
                  "callFunction": "SpawnDamageText",
                  "sid": 274909062158608,
                  "parameters": [
                    "Enemy_Sprite.UID",
                    "damage"
                  ]
                }
              ],
              "sid": 432755715977805
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "Update_Bars",
              "sid": 246342545573399
            }
          ],
          "sid": 669287577601169
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 290783021249400,
              "parameters": {
                "unique-id": "actorUID"
              }
            }
          ],
          "actions": [],
          "sid": 692453805352023,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 426032757541710,
                  "parameters": {
                    "first-value": "Heroes.heroIndex",
                    "comparison": 0,
                    "second-value": "0"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 698758257992131,
                  "parameters": {
                    "variable": "aoeName",
                    "value": "\"Pummel\""
                  }
                }
              ],
              "sid": 344146690983675
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 720645673750960,
                  "parameters": {
                    "first-value": "Heroes.heroIndex",
                    "comparison": 0,
                    "second-value": "1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 694840119595353,
                  "parameters": {
                    "variable": "aoeName",
                    "value": "\"Swipe\""
                  }
                }
              ],
              "sid": 418900058788305
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 208592331828323,
                  "parameters": {
                    "first-value": "Heroes.heroIndex",
                    "comparison": 0,
                    "second-value": "2"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 960133689675690,
                  "parameters": {
                    "variable": "aoeName",
                    "value": "\"Burst\""
                  }
                }
              ],
              "sid": 560688898864622
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 757841561624273,
                  "parameters": {
                    "first-value": "Heroes.heroIndex",
                    "comparison": 0,
                    "second-value": "3"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 982929478297802,
                  "parameters": {
                    "variable": "aoeName",
                    "value": "\"Faze\""
                  }
                }
              ],
              "sid": 368986158010118
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 139559349049853,
              "parameters": {
                "object": "Enemy_Sprite"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Enemy_Sprite",
              "sid": 760483666599324,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 3,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "KillEnemyAt",
              "sid": 456240124507793,
              "parameters": [
                "Enemy_Sprite.slotIndex"
              ]
            }
          ],
          "sid": 182612273503636
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "callFunction": "LogCombat",
              "sid": 149336369150145,
              "parameters": [
                "actorName & \" used \" & aoeName & \" on all enemies for \" & totalDamage & \"!\""
              ]
            },
            {
              "id": "wait",
              "objectClass": "System",
              "sid": 469851838199945,
              "parameters": {
                "seconds": "1.0",
                "use-timescale": true
              }
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 906855158075240
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 860144427191568
            }
          ],
          "sid": 960078892766764
        }
      ]
    },
    {
      "functionName": "ResolveEnemyAction",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 543078262816812
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 371156033785630,
      "children": [
        {
          "eventType": "variable",
          "name": "handled",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 893725292441003
        },
        {
          "eventType": "variable",
          "name": "enemyName",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 698941377669049
        },
        {
          "eventType": "variable",
          "name": "roll",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 751310702270560
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 974352157854353,
              "parameters": {
                "variable": "handled",
                "value": "0"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 563667172301071,
              "parameters": {
                "variable": "roll",
                "value": "random(1)"
              }
            }
          ],
          "sid": 129173467514285
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 164607298710132,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 775786604308382,
              "parameters": {
                "variable": "enemyName",
                "value": "Enemy_Sprite.name"
              }
            }
          ],
          "sid": 173303542346062,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-eventvar",
                  "objectClass": "System",
                  "sid": 668055309642068,
                  "parameters": {
                    "variable": "handled",
                    "comparison": 0,
                    "value": "0"
                  }
                },
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Enemy_Sprite",
                  "sid": 613549390399731,
                  "parameters": {
                    "instance-variable": "name",
                    "comparison": 0,
                    "value": "\"Chimerilass\""
                  }
                },
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Enemy_Sprite",
                  "sid": 558054252746251,
                  "parameters": {
                    "instance-variable": "HP",
                    "comparison": 2,
                    "value": "Enemy_Sprite.maxHP"
                  }
                },
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 866165909625958,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 2,
                    "second-value": "0.49"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 697102420309523,
                  "parameters": {
                    "variable": "handled",
                    "value": "Functions.ExecuteEnemySkill(\"Enemy_Heal_Self\", enemyUID)"
                  }
                }
              ],
              "sid": 681049567734567
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-eventvar",
                  "objectClass": "System",
                  "sid": 556863260172453,
                  "parameters": {
                    "variable": "handled",
                    "comparison": 0,
                    "value": "0"
                  }
                },
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Enemy_Sprite",
                  "sid": 761394847749362,
                  "parameters": {
                    "instance-variable": "name",
                    "comparison": 0,
                    "value": "\"Djinn\""
                  }
                },
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 937084694169116,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 2,
                    "second-value": "0.85"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 820029262466813,
                  "parameters": {
                    "variable": "handled",
                    "value": "Functions.ExecuteEnemySkill(\"Enemy_MAG_Single\", enemyUID)"
                  }
                }
              ],
              "sid": 797764884418634
            },
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-eventvar",
                  "objectClass": "System",
                  "sid": 782967810712094,
                  "parameters": {
                    "variable": "handled",
                    "comparison": 0,
                    "value": "0"
                  }
                },
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Enemy_Sprite",
                  "sid": 299246559727846,
                  "parameters": {
                    "instance-variable": "name",
                    "comparison": 0,
                    "value": "\"Marid\""
                  }
                },
                {
                  "id": "compare-two-values",
                  "objectClass": "System",
                  "sid": 845606188427750,
                  "parameters": {
                    "first-value": "roll",
                    "comparison": 2,
                    "second-value": "0.65"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 279746357165549,
                  "parameters": {
                    "variable": "handled",
                    "value": "Functions.ExecuteEnemySkill(\"Enemy_MAG_Single\", enemyUID)"
                  }
                }
              ],
              "sid": 622207991042581
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 682164705545810,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 512725892074523,
              "parameters": {
                "value": "0"
              }
            }
          ],
          "sid": 454498849224948
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 783924452540254,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 422532354241479,
              "parameters": {
                "value": "1"
              }
            }
          ],
          "sid": 467534180723974
        }
      ]
    },
    {
      "functionName": "ExecuteEnemySkill",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "skillId",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "sid": 739672016999895
        },
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 812659607937874
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 816635194474054,
      "children": [
        {
          "eventType": "variable",
          "name": "handled",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 776259905041424
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 219360260823846,
              "parameters": {
                "variable": "skillId",
                "comparison": 0,
                "value": "\"Enemy_Heal_Self\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 635679112339685,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Enemy_Heal_Self",
              "sid": 446920449125394,
              "parameters": [
                "enemyUID"
              ]
            },
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 522046746466790,
              "parameters": {
                "value": "handled"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 671420340389470
            }
          ],
          "sid": 729022972525904
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 197464534612585,
              "parameters": {
                "variable": "skillId",
                "comparison": 0,
                "value": "\"Enemy_MAG_Single\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 902733759908200,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Enemy_MAG_Single",
              "sid": 964753843404927,
              "parameters": [
                "enemyUID"
              ]
            },
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 528536483653372,
              "parameters": {
                "value": "handled"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 452030823470369
            }
          ],
          "sid": 667663878108788
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 245211823981263,
              "parameters": {
                "variable": "skillId",
                "comparison": 0,
                "value": "\"Enemy_ATK_Single\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 658718158476955,
              "parameters": {
                "variable": "handled",
                "value": "1"
              }
            },
            {
              "callFunction": "Enemy_ATK_Single",
              "sid": 105531472374147,
              "parameters": [
                "enemyUID"
              ]
            },
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 893882476067148,
              "parameters": {
                "value": "handled"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 676376443352755
            }
          ],
          "sid": 560315842318767
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 755833501378783,
              "parameters": {
                "variable": "skillId",
                "comparison": 0,
                "value": "\"Enemy_MAG_AOE\""
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 379268655842550,
              "parameters": {
                "variable": "handled",
                "value": "0"
              }
            },
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 769650284894576,
              "parameters": {
                "value": "handled"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 105424260713568
            }
          ],
          "sid": 894264684335011
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 814785216044387,
              "parameters": {
                "variable": "handled",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "callFunction": "LogCombat",
              "sid": 846455314584047,
              "parameters": [
                "\"ExecuteEnemySkill: UNKNOWN skillId='\" & skillId & \"'\""
              ]
            },
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 752625100943001,
              "parameters": {
                "value": "0"
              }
            }
          ],
          "sid": 163455651264543
        }
      ]
    },
    {
      "functionName": "Enemy_Heal_Self",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 995998997349500
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 667019708947570,
      "children": [
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 809140873322947,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 807911703920914,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "id": "set-y",
              "objectClass": "Enemy_Sprite",
              "sid": 307525971095952,
              "parameters": {
                "y": "Functions.SlotY(Enemy_Sprite.slotIndex) - 5"
              }
            },
            {
              "callFunction": "HealSelf",
              "sid": 369100900281257,
              "parameters": [
                "enemyUID",
                "1"
              ]
            },
            {
              "callFunction": "LogCombat",
              "sid": 197794973662604,
              "parameters": [
                "Enemy_Sprite.name & \" healed for \" & LastHealed & \"!\""
              ]
            },
            {
              "id": "wait",
              "objectClass": "System",
              "sid": 418133644538637,
              "parameters": {
                "seconds": "0.5",
                "use-timescale": true
              }
            },
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 936196772614572,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "id": "set-y",
              "objectClass": "Enemy_Sprite",
              "sid": 200375516839095,
              "parameters": {
                "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 809818000119265
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 419553505544027
            }
          ],
          "sid": 157686717290675
        }
      ]
    },
    {
      "functionName": "Enemy_MAG_Single",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 988213184761725
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 880724966202375,
      "children": [
        {
          "eventType": "variable",
          "name": "heroCount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 930218121713858
        },
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 429609942241162
        },
        {
          "eventType": "variable",
          "name": "enemyNameText",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 356077718133018
        },
        {
          "eventType": "variable",
          "name": "heroNameText",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 876244580794950
        },
        {
          "eventType": "variable",
          "name": "targetHeroUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 940697057027605
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 915461005875109,
              "parameters": {
                "variable": "heroCount",
                "value": "0"
              }
            }
          ],
          "sid": 955339600414895
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 899132299682965,
              "parameters": {
                "object": "Heroes"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Heroes",
              "sid": 622642364991013,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 754359897321099,
              "parameters": {
                "variable": "heroCount",
                "value": "1"
              }
            }
          ],
          "sid": 216261721094858
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 159595125254070,
              "parameters": {
                "variable": "heroCount",
                "comparison": 0,
                "value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 867349183616582,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 726216514417439,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "id": "set-y",
              "objectClass": "Enemy_Sprite",
              "sid": 519396206689027,
              "parameters": {
                "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 793383260200307
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 350098618427641
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 106421492643703
            }
          ],
          "sid": 499784853344919
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 652998820496698,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 708825445014911,
              "parameters": {
                "variable": "enemyNameText",
                "value": "Enemy_Sprite.name"
              }
            }
          ],
          "sid": 750311184257489,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 299591591074864,
                  "parameters": {
                    "instance-variable": "HP",
                    "comparison": 4,
                    "value": "0"
                  }
                },
                {
                  "id": "pick-random-instance",
                  "objectClass": "System",
                  "sid": 591669329436220,
                  "parameters": {
                    "object": "Heroes"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 803029841379098,
                  "parameters": {
                    "variable": "targetHeroUID",
                    "value": "Heroes.UID"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 733453768151122,
                  "parameters": {
                    "variable": "heroNameText",
                    "value": "Heroes.name"
                  }
                },
                {
                  "id": "set-text",
                  "objectClass": "ActorIntent",
                  "sid": 961700444847262,
                  "parameters": {
                    "text": "\"ENEMY \" & enemyUID & \" MAG TARGET heroUID=\" & targetHeroUID & \" heroIndex=\" & Heroes.heroIndex"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 976978974596188,
                  "parameters": {
                    "variable": "damage",
                    "value": "Functions.MagicCalc(enemyUID,targetHeroUID)"
                  }
                }
              ],
              "sid": 220948202732362
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "wait",
              "objectClass": "System",
              "sid": 130108908331616,
              "parameters": {
                "seconds": "0.5",
                "use-timescale": true
              }
            }
          ],
          "sid": 839740965017269
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 846544550115564,
              "parameters": {
                "unique-id": "targetHeroUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-y",
              "objectClass": "Heroes",
              "sid": 798162272558273,
              "parameters": {
                "y": "Heroes.Y+5"
              }
            }
          ],
          "sid": 576627907935690,
          "children": [
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "id": "wait",
                  "objectClass": "System",
                  "sid": 151064750369565,
                  "parameters": {
                    "seconds": "0.5",
                    "use-timescale": true
                  }
                },
                {
                  "callFunction": "ApplyPartyDamage",
                  "sid": 977379750601383,
                  "parameters": [
                    "damage"
                  ]
                }
              ],
              "sid": 364129838310435,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "pick-by-unique-id",
                      "objectClass": "Enemy_Sprite",
                      "sid": 313567667939217,
                      "parameters": {
                        "unique-id": "enemyUID"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-x",
                      "objectClass": "Enemy_Sprite",
                      "sid": 738821301600398,
                      "parameters": {
                        "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
                      }
                    },
                    {
                      "id": "set-y",
                      "objectClass": "Enemy_Sprite",
                      "sid": 984391513541586,
                      "parameters": {
                        "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
                      }
                    }
                  ],
                  "sid": 908165731095335
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "callFunction": "LogCombat",
                  "sid": 551197901871512,
                  "parameters": [
                    "enemyNameText & \" cast on \" & heroNameText & \" for \" & damage & \"!\""
                  ]
                },
                {
                  "id": "set-y",
                  "objectClass": "Heroes",
                  "sid": 805937934008299,
                  "parameters": {
                    "y": "Heroes.Y-5"
                  }
                },
                {
                  "id": "wait",
                  "objectClass": "System",
                  "sid": 374071673236126,
                  "parameters": {
                    "seconds": "0.3",
                    "use-timescale": true
                  }
                },
                {
                  "callFunction": "AdvanceTurn",
                  "sid": 416958071572810
                },
                {
                  "callFunction": "ProcessTurn",
                  "sid": 383433886844145
                }
              ],
              "sid": 798858145802430
            }
          ]
        }
      ]
    },
    {
      "functionName": "Enemy_ATK_Single",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "enemyUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 782480248993554
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 544354981351320,
      "children": [
        {
          "eventType": "variable",
          "name": "heroCount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 684239859770611
        },
        {
          "eventType": "variable",
          "name": "damage",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 309728757494052
        },
        {
          "eventType": "variable",
          "name": "enemyNameText",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 620898018726904
        },
        {
          "eventType": "variable",
          "name": "heroNameText",
          "type": "string",
          "initialValue": "\"\"",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 296932795589144
        },
        {
          "eventType": "variable",
          "name": "targetHeroUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 618134236398371
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 529173109476533,
              "parameters": {
                "variable": "heroCount",
                "value": "0"
              }
            }
          ],
          "sid": 784251588027618
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for-each",
              "objectClass": "System",
              "sid": 246875659561674,
              "parameters": {
                "object": "Heroes"
              }
            },
            {
              "id": "compare-instance-variable",
              "objectClass": "Heroes",
              "sid": 264898691251978,
              "parameters": {
                "instance-variable": "HP",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "add-to-eventvar",
              "objectClass": "System",
              "sid": 768891258967457,
              "parameters": {
                "variable": "heroCount",
                "value": "1"
              }
            }
          ],
          "sid": 763320656317079
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 223749079141513,
              "parameters": {
                "variable": "heroCount",
                "comparison": 0,
                "value": "0"
              }
            },
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 380955192628167,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-x",
              "objectClass": "Enemy_Sprite",
              "sid": 877384265456271,
              "parameters": {
                "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "id": "set-y",
              "objectClass": "Enemy_Sprite",
              "sid": 673440798780697,
              "parameters": {
                "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
              }
            },
            {
              "callFunction": "AdvanceTurn",
              "sid": 537911137161123
            },
            {
              "callFunction": "ProcessTurn",
              "sid": 679227182413347
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 954087561806593
            }
          ],
          "sid": 466749853450235
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 846490592329522,
              "parameters": {
                "unique-id": "enemyUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 734105933566425,
              "parameters": {
                "variable": "enemyNameText",
                "value": "Enemy_Sprite.name"
              }
            }
          ],
          "sid": 837571907154231,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "compare-instance-variable",
                  "objectClass": "Heroes",
                  "sid": 261577350472800,
                  "parameters": {
                    "instance-variable": "HP",
                    "comparison": 4,
                    "value": "0"
                  }
                },
                {
                  "id": "pick-random-instance",
                  "objectClass": "System",
                  "sid": 247760383096747,
                  "parameters": {
                    "object": "Heroes"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 556004889512252,
                  "parameters": {
                    "variable": "targetHeroUID",
                    "value": "Heroes.UID"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 671817528496240,
                  "parameters": {
                    "variable": "heroNameText",
                    "value": "Heroes.name"
                  }
                },
                {
                  "id": "set-text",
                  "objectClass": "ActorIntent",
                  "sid": 107307216436107,
                  "parameters": {
                    "text": "\"ENEMY \" & enemyUID & \" ATK TARGET heroUID=\" & targetHeroUID & \" heroIndex=\" & Heroes.heroIndex"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 294341561139304,
                  "parameters": {
                    "variable": "damage",
                    "value": "Functions.MeleeCalc(enemyUID,targetHeroUID)"
                  }
                }
              ],
              "sid": 273866770455015
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "wait",
              "objectClass": "System",
              "sid": 255186882595496,
              "parameters": {
                "seconds": "0.5",
                "use-timescale": true
              }
            }
          ],
          "sid": 319685395267925
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Heroes",
              "sid": 806219725610743,
              "parameters": {
                "unique-id": "targetHeroUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-y",
              "objectClass": "Heroes",
              "sid": 793695650555070,
              "parameters": {
                "y": "Heroes.Y+5"
              }
            }
          ],
          "sid": 736543322629207,
          "children": [
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "id": "wait",
                  "objectClass": "System",
                  "sid": 668903533529731,
                  "parameters": {
                    "seconds": "0.5",
                    "use-timescale": true
                  }
                },
                {
                  "callFunction": "ApplyPartyDamage",
                  "sid": 600766228938725,
                  "parameters": [
                    "damage"
                  ]
                }
              ],
              "sid": 578217310747861,
              "children": [
                {
                  "eventType": "block",
                  "conditions": [
                    {
                      "id": "pick-by-unique-id",
                      "objectClass": "Enemy_Sprite",
                      "sid": 304802631487906,
                      "parameters": {
                        "unique-id": "enemyUID"
                      }
                    }
                  ],
                  "actions": [
                    {
                      "id": "set-x",
                      "objectClass": "Enemy_Sprite",
                      "sid": 757968721331559,
                      "parameters": {
                        "x": "Functions.SlotX(Enemy_Sprite.slotIndex)"
                      }
                    },
                    {
                      "id": "set-y",
                      "objectClass": "Enemy_Sprite",
                      "sid": 498271262153965,
                      "parameters": {
                        "y": "Functions.SlotY(Enemy_Sprite.slotIndex)"
                      }
                    }
                  ],
                  "sid": 719756351492258
                }
              ]
            },
            {
              "eventType": "block",
              "conditions": [],
              "actions": [
                {
                  "callFunction": "LogCombat",
                  "sid": 110941528536013,
                  "parameters": [
                    "enemyNameText & \" hit \" & heroNameText & \" for \" & damage & \"!\""
                  ]
                },
                {
                  "id": "set-y",
                  "objectClass": "Heroes",
                  "sid": 279711193421551,
                  "parameters": {
                    "y": "Heroes.Y-5"
                  }
                },
                {
                  "id": "wait",
                  "objectClass": "System",
                  "sid": 173371557032085,
                  "parameters": {
                    "seconds": "0.3",
                    "use-timescale": true
                  }
                },
                {
                  "callFunction": "AdvanceTurn",
                  "sid": 425624282388799
                },
                {
                  "callFunction": "ProcessTurn",
                  "sid": 960973904700335
                }
              ],
              "sid": 517864206421341
            }
          ]
        }
      ]
    },
    {
      "functionName": "LogCombat",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "msg",
          "type": "string",
          "initialValue": "",
          "comment": "",
          "sid": 533232877263405
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 639809709549652,
      "children": [
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-text",
              "objectClass": "CombatAction",
              "sid": 521576612598639,
              "parameters": {
                "text": "CombatAction1.Text"
              }
            },
            {
              "id": "set-text",
              "objectClass": "CombatAction1",
              "sid": 129835712924181,
              "parameters": {
                "text": "CombatAction2.Text"
              }
            },
            {
              "id": "set-text",
              "objectClass": "CombatAction2",
              "sid": 184932184022132,
              "parameters": {
                "text": "CombatAction3.Text"
              }
            },
            {
              "id": "set-text",
              "objectClass": "CombatAction3",
              "sid": 263396005641038,
              "parameters": {
                "text": "msg"
              }
            }
          ],
          "sid": 218520323058894
        }
      ]
    },
    {
      "functionName": "SpawnDamageText",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "targetUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 904912224433614
        },
        {
          "name": "amount",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 213248393461637
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 933368122234081,
      "children": [
        {
          "eventType": "variable",
          "name": "startX",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 706849614742330
        },
        {
          "eventType": "variable",
          "name": "startY",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 200658142905404
        },
        {
          "eventType": "variable",
          "name": "riseDist",
          "type": "number",
          "initialValue": "14",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 788691889711308
        },
        {
          "eventType": "variable",
          "name": "dtUID",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 658212305264103
        },
        {
          "eventType": "variable",
          "name": "riseInSec",
          "type": "number",
          "initialValue": "0.12",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 993991076379477
        },
        {
          "eventType": "variable",
          "name": "holdSec",
          "type": "number",
          "initialValue": "1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 911457259633764
        },
        {
          "eventType": "variable",
          "name": "fadeSec",
          "type": "number",
          "initialValue": "0.25",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 158415017816186
        },
        {
          "eventType": "variable",
          "name": "foundTarget",
          "type": "number",
          "initialValue": "0.25",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 504958245983524
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "Enemy_Sprite",
              "sid": 575107733658379,
              "parameters": {
                "unique-id": "targetUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 351786568323271,
              "parameters": {
                "variable": "foundTarget",
                "value": "1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 698992749483207,
              "parameters": {
                "variable": "startX",
                "value": "Enemy_Sprite.BBoxMidX"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 676041706988725,
              "parameters": {
                "variable": "startY",
                "value": "Enemy_Sprite.BBoxTop"
              }
            }
          ],
          "sid": 547555423095552
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 817519924172652,
              "parameters": {
                "variable": "foundTarget",
                "comparison": 0,
                "value": "0"
              }
            },
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 429550670285042,
              "parameters": {
                "variable": "targetUID",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 258779970225925,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Enemy_Sprite",
                  "sid": 789235315661010,
                  "parameters": {
                    "unique-id": "targetUID-1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 192402504470163,
                  "parameters": {
                    "variable": "foundTarget",
                    "value": "1"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 955225735055978,
                  "parameters": {
                    "variable": "startX",
                    "value": "Enemy_Sprite.BBoxMidX"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 670282894691092,
                  "parameters": {
                    "variable": "startY",
                    "value": "Enemy_Sprite.BBoxTop"
                  }
                }
              ],
              "sid": 924602947638200
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 607318823431644,
              "parameters": {
                "variable": "foundTarget",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 876008416817168,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Heroes",
                  "sid": 718829025384811,
                  "parameters": {
                    "unique-id": "targetUID"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 786661075326721,
                  "parameters": {
                    "variable": "foundTarget",
                    "value": "1"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 543909939804589,
                  "parameters": {
                    "variable": "startX",
                    "value": "Heroes.BBoxMidX"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 761702142319813,
                  "parameters": {
                    "variable": "startY",
                    "value": "Heroes.BBoxTop"
                  }
                }
              ],
              "sid": 511231192440885
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 159027853444109,
              "parameters": {
                "variable": "foundTarget",
                "comparison": 0,
                "value": "0"
              }
            },
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 853780010238812,
              "parameters": {
                "variable": "targetUID",
                "comparison": 4,
                "value": "0"
              }
            }
          ],
          "actions": [],
          "sid": 474830896806150,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "pick-by-unique-id",
                  "objectClass": "Heroes",
                  "sid": 664362679766169,
                  "parameters": {
                    "unique-id": "targetUID-1"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 663203146799879,
                  "parameters": {
                    "variable": "foundTarget",
                    "value": "1"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 460386967255988,
                  "parameters": {
                    "variable": "startX",
                    "value": "Heroes.BBoxMidX"
                  }
                },
                {
                  "id": "set-eventvar-value",
                  "objectClass": "System",
                  "sid": 637754341551198,
                  "parameters": {
                    "variable": "startY",
                    "value": "Heroes.BBoxTop"
                  }
                }
              ],
              "sid": 248353089863739
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "create-object",
              "objectClass": "System",
              "sid": 993953945227592,
              "parameters": {
                "object-to-create": "DamageText",
                "layer": "\"UI\"",
                "x": "startX",
                "y": "startY+riseDist",
                "create-hierarchy": false,
                "template-name": "\"\""
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 913125869186158,
              "parameters": {
                "variable": "dtUID",
                "value": "DamageText.UID"
              }
            }
          ],
          "sid": 521949668094475
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "pick-by-unique-id",
              "objectClass": "DamageText",
              "sid": 497068703297152,
              "parameters": {
                "unique-id": "dtUID"
              }
            }
          ],
          "actions": [
            {
              "id": "set-x",
              "objectClass": "DamageText",
              "sid": 912305871465995,
              "parameters": {
                "x": "startX - (DamageText.Width / 2)"
              }
            },
            {
              "id": "set-text",
              "objectClass": "DamageText",
              "sid": 322914684588889,
              "parameters": {
                "text": "amount"
              }
            },
            {
              "id": "set-opacity",
              "objectClass": "DamageText",
              "sid": 248030577951975,
              "parameters": {
                "opacity": "100"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 316607228147855,
              "parameters": {
                "instance-variable": "yStart",
                "value": "startY+riseDist"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 171552819322239,
              "parameters": {
                "instance-variable": "yTarget",
                "value": "startY"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 675066133176051,
              "parameters": {
                "instance-variable": "age",
                "value": "0"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 145671337599511,
              "parameters": {
                "instance-variable": "phase",
                "value": "0"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 113043112478021,
              "parameters": {
                "instance-variable": "riseInSec",
                "value": "riseInSec"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 896431404973618,
              "parameters": {
                "instance-variable": "holdSec",
                "value": "holdSec"
              }
            },
            {
              "id": "set-instvar-value",
              "objectClass": "DamageText",
              "sid": 267364249424752,
              "parameters": {
                "instance-variable": "fadeSec",
                "value": "fadeSec"
              }
            }
          ],
          "sid": 505761722479627
        }
      ]
    },
    {
      "functionName": "GrabNextBuffSlot",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "number",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 416239020275433,
      "children": [
        {
          "eventType": "variable",
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 832614478196484
        },
        {
          "eventType": "variable",
          "name": "oldW",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 287636435814932
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 276801252088552,
              "parameters": {
                "variable": "oldW",
                "value": "TrackBuffs.Width"
              }
            },
            {
              "id": "set-size",
              "objectClass": "TrackBuffs",
              "sid": 327775737809698,
              "parameters": {
                "width": "5",
                "height": "1",
                "depth": "1"
              }
            }
          ],
          "sid": 299542039020679
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 749549824738098,
              "parameters": {
                "variable": "oldW",
                "comparison": 2,
                "value": "5"
              }
            }
          ],
          "actions": [],
          "sid": 905444221479186,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 441633173036771,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "oldW",
                    "end-index": "4"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-at-xyz",
                  "objectClass": "TrackBuffs",
                  "sid": 902031792239644,
                  "parameters": {
                    "x": "loopindex(\"i\")",
                    "y": "0",
                    "z": "0",
                    "value": "-1"
                  }
                }
              ],
              "sid": 344363627065795
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 447333191598211,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "4"
              }
            },
            {
              "id": "compare-at-xyz",
              "objectClass": "TrackBuffs",
              "sid": 169067251656063,
              "parameters": {
                "x": "loopindex(\"i\")",
                "y": "0",
                "z": "0",
                "comparison": 0,
                "value": "-1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 152357827598424,
              "parameters": {
                "value": "loopindex(\"i\")"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 194808520514232
            }
          ],
          "sid": 292210889229302
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-function-return-value",
              "objectClass": "Functions",
              "sid": 874437206307214,
              "parameters": {
                "value": "4"
              }
            }
          ],
          "sid": 587666051131391
        }
      ]
    },
    {
      "functionName": "StartBuffRoll",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [
        {
          "name": "buffType",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 462696121499337
        },
        {
          "name": "actorUID",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "sid": 361239532815518
        }
      ],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 626154100867226,
      "children": [
        {
          "eventType": "variable",
          "name": "slotindex",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 985732612960052
        },
        {
          "eventType": "variable",
          "name": "i",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 587791531058194
        },
        {
          "eventType": "variable",
          "name": "oldW",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 993346947757831
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 218371372892527,
              "parameters": {
                "variable": "buffType",
                "comparison": 2,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 428338717997276
            }
          ],
          "sid": 309276724583583
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 647399315888911,
              "parameters": {
                "variable": "buffType",
                "comparison": 4,
                "value": "4"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 756803602852012
            }
          ],
          "sid": 789741230157200
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 172956145057230,
              "parameters": {
                "variable": "IsPlayerBusy",
                "value": "1"
              }
            },
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 870191031258929,
              "parameters": {
                "variable": "CanPickGems",
                "value": "false"
              }
            },
            {
              "id": "set-boolean-eventvar",
              "objectClass": "System",
              "sid": 471309286978139,
              "parameters": {
                "variable": "SuppressChainUI",
                "value": "true"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 752877995197736,
              "parameters": {
                "variable": "BuffRollActive",
                "value": "1"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 802497341037722,
              "parameters": {
                "variable": "BuffRollType",
                "value": "buffType"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 941622800023392,
              "parameters": {
                "variable": "BuffRollFrame",
                "value": "0"
              }
            }
          ],
          "sid": 673731755550039
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 196582171362376,
              "parameters": {
                "variable": "oldW",
                "value": "TrackBuffs.Width"
              }
            },
            {
              "id": "set-size",
              "objectClass": "TrackBuffs",
              "sid": 699892458460131,
              "parameters": {
                "width": "5",
                "height": "1",
                "depth": "1"
              }
            }
          ],
          "sid": 513441925644472
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 698910984174677,
              "parameters": {
                "variable": "oldW",
                "comparison": 2,
                "value": "5"
              }
            }
          ],
          "actions": [],
          "sid": 133099322316486,
          "children": [
            {
              "eventType": "block",
              "conditions": [
                {
                  "id": "for",
                  "objectClass": "System",
                  "sid": 403998059612027,
                  "parameters": {
                    "name": "\"i\"",
                    "start-index": "oldW",
                    "end-index": "4"
                  }
                }
              ],
              "actions": [
                {
                  "id": "set-at-xyz",
                  "objectClass": "TrackBuffs",
                  "sid": 479972073290406,
                  "parameters": {
                    "x": "loopindex(\"i\")",
                    "y": "0",
                    "z": "0",
                    "value": "-1"
                  }
                }
              ],
              "sid": 630390024685643
            }
          ]
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 485949341098249,
              "parameters": {
                "variable": "slotindex",
                "value": "4"
              }
            }
          ],
          "sid": 326164299422352
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "for",
              "objectClass": "System",
              "sid": 860515099108252,
              "parameters": {
                "name": "\"i\"",
                "start-index": "0",
                "end-index": "4"
              }
            },
            {
              "id": "compare-at-xyz",
              "objectClass": "TrackBuffs",
              "sid": 146991291374519,
              "parameters": {
                "x": "loopindex(\"i\")",
                "y": "0",
                "z": "0",
                "comparison": 0,
                "value": "-1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 129592965714616,
              "parameters": {
                "variable": "slotindex",
                "value": "loopindex(\"i\")"
              }
            },
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 295303627551129
            }
          ],
          "sid": 408960233138533
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 485553121257914,
              "parameters": {
                "variable": "BuffRollSlot",
                "value": "slotindex"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 813617937151256,
              "parameters": {
                "variable": "BuffRollEndsAt",
                "value": "time+0.9"
              }
            }
          ],
          "sid": 425878762338368
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 140908820548167,
              "parameters": {
                "variable": "BuffRollSlot",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "buffIcon1",
              "sid": 571215972251981,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon1",
              "sid": 122434669383685,
              "parameters": {
                "frame-number": "0"
              }
            }
          ],
          "sid": 333968975006554
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 943980855833501,
              "parameters": {
                "variable": "BuffRollSlot",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "buffIcon2",
              "sid": 695462801716301,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon2",
              "sid": 296221606474631,
              "parameters": {
                "frame-number": "0"
              }
            }
          ],
          "sid": 769060415876576
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 821574040763725,
              "parameters": {
                "variable": "BuffRollSlot",
                "comparison": 0,
                "value": "2"
              }
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "buffIcon3",
              "sid": 569556734640107,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon3",
              "sid": 824604377361318,
              "parameters": {
                "frame-number": "0"
              }
            }
          ],
          "sid": 759889484447655
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 342979922079582,
              "parameters": {
                "variable": "BuffRollSlot",
                "comparison": 0,
                "value": "3"
              }
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "buffIcon4",
              "sid": 468739152222229,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon4",
              "sid": 260868029553467,
              "parameters": {
                "frame-number": "0"
              }
            }
          ],
          "sid": 830709445117733
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 417947125978428,
              "parameters": {
                "variable": "BuffRollSlot",
                "comparison": 0,
                "value": "4"
              }
            }
          ],
          "actions": [
            {
              "id": "set-visible",
              "objectClass": "buffIcon5",
              "sid": 733772576887193,
              "parameters": {
                "visibility": "visible"
              }
            },
            {
              "id": "set-animation-frame",
              "objectClass": "buffIcon5",
              "sid": 131221367936797,
              "parameters": {
                "frame-number": "0"
              }
            }
          ],
          "sid": 473551305180277
        }
      ]
    },
    {
      "functionName": "ShowBuffProgress",
      "functionDescription": "",
      "functionCategory": "",
      "functionReturnType": "none",
      "functionCopyPicked": false,
      "functionIsAsync": false,
      "functionParameters": [],
      "eventType": "function-block",
      "conditions": [],
      "actions": [],
      "sid": 550824884300673,
      "children": [
        {
          "eventType": "variable",
          "name": "slot",
          "type": "number",
          "initialValue": "-1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 689034274415361
        },
        {
          "eventType": "variable",
          "name": "pct",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 558492987828822
        },
        {
          "eventType": "variable",
          "name": "cur",
          "type": "number",
          "initialValue": "0",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 654838042647146
        },
        {
          "eventType": "variable",
          "name": "cap",
          "type": "number",
          "initialValue": "1",
          "comment": "",
          "isStatic": false,
          "isConstant": false,
          "sid": 403540647292671
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 249739776655105,
              "parameters": {
                "variable": "slot",
                "value": "BuffRollSlot"
              }
            }
          ],
          "sid": 520338707915582
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 439481329342437,
              "parameters": {
                "variable": "slot",
                "comparison": 2,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "stop-loop",
              "objectClass": "System",
              "sid": 912248409229336
            }
          ],
          "sid": 302879461628744
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 219752253733605,
              "parameters": {
                "variable": "BuffRollType",
                "comparison": 0,
                "value": "0"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 422740395638793,
              "parameters": {
                "variable": "cur",
                "value": "PartyBuff_DEF"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 476328198941922,
              "parameters": {
                "variable": "cap",
                "value": "PartyBuffCap_DEF"
              }
            }
          ],
          "sid": 151505511369379
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 204877402343566,
              "parameters": {
                "variable": "BuffRollType",
                "comparison": 0,
                "value": "1"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 249463829046985,
              "parameters": {
                "variable": "cur",
                "value": "PartyBuff_ATK"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 773089936043143,
              "parameters": {
                "variable": "cap",
                "value": "PartyBuffCap_ATK"
              }
            }
          ],
          "sid": 115964303256600
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 967982481901306,
              "parameters": {
                "variable": "BuffRollType",
                "comparison": 0,
                "value": "2"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 181094829571948,
              "parameters": {
                "variable": "cur",
                "value": "PartyBuff_MAG"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 371900829634082,
              "parameters": {
                "variable": "cap",
                "value": "PartyBuffCap_MAG"
              }
            }
          ],
          "sid": 237049101058665
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 821896246114932,
              "parameters": {
                "variable": "BuffRollType",
                "comparison": 0,
                "value": "3"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 478315951981416,
              "parameters": {
                "variable": "cur",
                "value": "PartyBuff_SPD"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 423065658823036,
              "parameters": {
                "variable": "cap",
                "value": "PartyBuffCap_SPD"
              }
            }
          ],
          "sid": 834446998594949
        },
        {
          "eventType": "block",
          "conditions": [
            {
              "id": "compare-eventvar",
              "objectClass": "System",
              "sid": 316657567583432,
              "parameters": {
                "variable": "BuffRollType",
                "comparison": 0,
                "value": "4"
              }
            }
          ],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 663153521918444,
              "parameters": {
                "variable": "cur",
                "value": "PartyBuff_RES"
              }
            },
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 425784134956441,
              "parameters": {
                "variable": "cap",
                "value": "PartyBuffCap_RES"
              }
            }
          ],
          "sid": 348570360234516
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [
            {
              "id": "set-eventvar-value",
              "objectClass": "System",
              "sid": 259023288651369,
              "parameters": {
                "variable": "pct",
                "value": "clamp(cur / max(1, cap), 0, 1)"
              }
            }
          ],
          "sid": 144698693454083
        },
        {
          "eventType": "block",
          "conditions": [],
          "actions": [],
          "sid": 239571877032512
        }
      ]
    }
  ],
  "sid": 455283106703198
};

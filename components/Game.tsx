import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
    PLAYER_SPEED, ROAD_WIDTH, ROAD_LENGTH, LANE_WIDTH, NUM_ENEMIES,
    ENEMY_COLORS, NUM_COINS, FOV, MAX_SPEED, ACCELERATION,
    DECELERATION, BRAKING_FORCE, ENEMY_SPEED_MULTIPLIER
} from '../constants';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: () => void;
  moveDirectionRef: React.MutableRefObject<number>;
  accelerateRef: React.MutableRefObject<boolean>;
  brakeRef: React.MutableRefObject<boolean>;
  carColor: string;
}

const Game: React.FC<GameProps> = ({ 
  onScoreUpdate, 
  onGameOver, 
  moveDirectionRef,
  accelerateRef,
  brakeRef,
  carColor
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const currentSpeed = useRef(0);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const engineSoundRef = useRef<{
    oscillator: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- AUDIO SETUP ---
    const initAudio = () => {
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch(e) {
                console.error("Web Audio API is not supported in this browser");
            }
        }
    };

    const playCoinSound = () => {
        const audioContext = audioContextRef.current;
        if (!audioContext || audioContext.state !== 'running') return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    };

    const startEngineSound = () => {
        const audioContext = audioContextRef.current;
        if (!audioContext || engineSoundRef.current) return;
        
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(60, audioContext.currentTime); // Idle RPM

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, audioContext.currentTime);

        gain.gain.setValueAtTime(0, audioContext.currentTime); // Start silent

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        oscillator.start();

        engineSoundRef.current = { oscillator, gain };
    };
    
    const initAudioOnce = () => {
        if (audioContextRef.current?.state === 'running' && engineSoundRef.current) return;
        initAudio();
        const audioContext = audioContextRef.current;
        if (audioContext) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            if (!engineSoundRef.current) {
                startEngineSound();
            }
        }
    };
    

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 10, 150);

    const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);

    // Sky Objects
    // Sun
    const createSunTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) return null;
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0.0, 'rgba(255, 255, 220, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 240, 180, 0.5)');
        gradient.addColorStop(1.0, 'rgba(255, 240, 180, 0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }
    const sunTexture = createSunTexture();
    if(sunTexture) {
        const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture, blending: THREE.AdditiveBlending, depthWrite: false }));
        sunSprite.position.set(80, 60, -150);
        sunSprite.scale.set(60, 60, 1);
        scene.add(sunSprite);
    }
    
    // Clouds
    const createCloudTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.fillStyle = 'white';
        context.globalAlpha = 0.6;
        const drawFluff = (x: number, y: number, r: number) => {
            context.beginPath();
            context.arc(x, y, r, 0, Math.PI * 2);
            context.fill();
        };
        drawFluff(60, 60, 30);
        drawFluff(90, 70, 40);
        drawFluff(130, 60, 50);
        drawFluff(170, 70, 40);
        drawFluff(200, 60, 30);
        return new THREE.CanvasTexture(canvas);
    };
    const cloudTexture = createCloudTexture();
    const clouds = new THREE.Group();
    for(let i = 0; i < 15; i++) {
        const cloudSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.8, depthWrite: false }));
        cloudSprite.position.set(
            (Math.random() - 0.5) * 400,
            Math.random() * 20 + 60,
            (Math.random() - 0.5) * 400
        );
        const scale = Math.random() * 30 + 30;
        cloudSprite.scale.set(scale * 2, scale, 1);
        clouds.add(cloudSprite);
    }
    scene.add(clouds);


    // Game Objects
    let playerCar: THREE.Group;
    const playerBBox = new THREE.Box3();

    const createPlayerCar = () => {
        const carGroup = new THREE.Group();

        // Create gradient texture for the car body
        const createGradientTexture = (baseColor: string) => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 256;
            const context = canvas.getContext('2d');
            if (!context) return null;

            const color = new THREE.Color(baseColor);
            const hsl = { h: 0, s: 0, l: 0 };
            color.getHSL(hsl);

            const lighterColor = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(1, hsl.l * 1.2 + 0.1)).getStyle();
            const darkerColor = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, hsl.l * 0.6)).getStyle();
            
            const gradient = context.createLinearGradient(0, 0, 0, 256);
            gradient.addColorStop(0, lighterColor);
            gradient.addColorStop(1, darkerColor);
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, 1, 256);
            return new THREE.CanvasTexture(canvas);
        }
        const gradientTexture = createGradientTexture(carColor);


        // Main Body with rounded edges and gradient
        const bodyGeometry = new RoundedBoxGeometry(2, 1, 4, 4, 0.2);
        const bodyMaterial = new THREE.MeshLambertMaterial({ map: gradientTexture });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.9;
        body.castShadow = true;
        carGroup.add(body);

        // Cabin with rounded edges
        const cabinGeometry = new RoundedBoxGeometry(1.6, 0.8, 2, 4, 0.15);
        const cabinMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc }); // Light grey
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.y = 1.8;
        cabin.position.z = -0.5;
        cabin.castShadow = true;
        carGroup.add(cabin);
        
        // Windows
        const windowMaterial = new THREE.MeshPhongMaterial({
            color: 0x44ddff, // Aqua glass color
            transparent: true,
            opacity: 0.5,
            shininess: 90,
            specular: 0x88ffff
        });
        
        // Front Window
        const frontWindowGeo = new THREE.BoxGeometry(1.5, 0.5, 0.05);
        const frontWindow = new THREE.Mesh(frontWindowGeo, windowMaterial);
        frontWindow.position.set(0, 0, 1.01); // Position relative to cabin center
        cabin.add(frontWindow);

        // Side Windows
        const sideWindowGeo = new THREE.BoxGeometry(0.05, 0.5, 0.8);
        const leftWindow = new THREE.Mesh(sideWindowGeo, windowMaterial);
        leftWindow.position.set(-0.81, 0, -0.2); // Position relative to cabin center
        cabin.add(leftWindow);
        const rightWindow = leftWindow.clone();
        rightWindow.position.x = 0.81;
        cabin.add(rightWindow);


        // Wheels
        const createWheelTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            if (!context) return null;

            // Tire background (not visible on face, but good practice)
            context.fillStyle = '#222222';
            context.fillRect(0, 0, 128, 128);

            // White rim
            context.beginPath();
            context.arc(64, 64, 56, 0, Math.PI * 2);
            context.fillStyle = 'white';
            context.fill();
            
            // Inner shadow for depth
            context.beginPath();
            context.arc(64, 64, 56, 0, Math.PI * 2);
            context.strokeStyle = 'rgba(0,0,0,0.2)';
            context.lineWidth = 4;
            context.stroke();

            // Black 'S' in the center
            context.font = 'bold 60px Arial';
            context.fillStyle = 'black';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('S', 64, 68);

            return new THREE.CanvasTexture(canvas);
        }

        const wheelTexture = createWheelTexture();
        const wheelFaceMaterial = wheelTexture 
            ? new THREE.MeshLambertMaterial({ map: wheelTexture })
            : new THREE.MeshLambertMaterial({ color: 0xffffff }); // Fallback

        const wheelSideMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 }); // Dark grey for tread
        
        const wheelMaterials = [
            wheelSideMaterial,   // side
            wheelFaceMaterial,   // top face
            wheelFaceMaterial    // bottom face
        ];

        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24);
        
        const wheelPositions = [
            { x: -1.15, z: 1.2 },  // Front-left
            { x: 1.15, z: 1.2 },   // Front-right
            { x: -1.15, z: -1.2 }, // Back-left
            { x: 1.15, z: -1.2 },  // Back-right
        ];

        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterials);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, 0.4, pos.z);
            wheel.castShadow = true;
            carGroup.add(wheel);
        });
        
        return carGroup;
    }

    playerCar = createPlayerCar();
    playerCar.rotation.y = Math.PI; // Face away from camera
    scene.add(playerCar);

    const groundGeometry = new THREE.PlaneGeometry(300, 400);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    const scenery = new THREE.Group();
    const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH * 2);
    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const roadPlane = new THREE.Mesh(roadGeometry, roadMaterial);
    roadPlane.rotation.x = -Math.PI / 2;
    roadPlane.position.y = 0.01;
    roadPlane.receiveShadow = true;
    scenery.add(roadPlane);

    // Lane markings
    const markingGeometry = new THREE.PlaneGeometry(0.3, 7);
    const markingMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 20; i++) {
        const marking1 = new THREE.Mesh(markingGeometry, markingMaterial);
        marking1.rotation.x = -Math.PI / 2;
        marking1.position.set(-LANE_WIDTH / 2, 0.02, i * 15 - ROAD_LENGTH);
        scenery.add(marking1);

        const marking2 = new THREE.Mesh(markingGeometry, markingMaterial);
        marking2.rotation.x = -Math.PI / 2;
        marking2.position.set(LANE_WIDTH / 2, 0.02, i * 15 - ROAD_LENGTH);
        scenery.add(marking2);
    }

    // Kerbs
    const kerbGeometry = new THREE.BoxGeometry(0.5, 0.2, ROAD_LENGTH * 2);
    const kerbMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const kerbLeft = new THREE.Mesh(kerbGeometry, kerbMaterial);
    kerbLeft.position.set(-ROAD_WIDTH/2 - 0.25, 0.1, 0);
    kerbLeft.castShadow = true;
    scenery.add(kerbLeft);

    const kerbRight = new THREE.Mesh(kerbGeometry, kerbMaterial);
    kerbRight.position.set(ROAD_WIDTH/2 + 0.25, 0.1, 0);
    kerbRight.castShadow = true;
    scenery.add(kerbRight);
    
    // Add red stripes to kerbs
    const stripeGeo = new THREE.BoxGeometry(0.5, 0.22, 1);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    for(let i = 0; i < ROAD_LENGTH; i++) {
        const stripeL = new THREE.Mesh(stripeGeo, stripeMat);
        stripeL.position.set(-ROAD_WIDTH/2 - 0.25, 0.11, (i * 2) - ROAD_LENGTH);
        scenery.add(stripeL);
        const stripeR = new THREE.Mesh(stripeGeo, stripeMat);
        stripeR.position.set(ROAD_WIDTH/2 + 0.25, 0.11, (i * 2) - ROAD_LENGTH);
        scenery.add(stripeR);
    }

    // Buildings
    const createBuilding = () => {
        const height = Math.random() * 30 + 10;
        const width = Math.random() * 8 + 8;
        const depth = Math.random() * 8 + 8;
        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        const buildingMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.7, 0.2, 0.5) });
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.castShadow = true;
        building.receiveShadow = true;
        building.position.y = height / 2 - 0.1;
        return building;
    }

    for (let i = 0; i < 25; i++) {
        const zPos = (i * 16) - ROAD_LENGTH;
        const buildingLeft = createBuilding();
        buildingLeft.position.x = -ROAD_WIDTH / 2 - 15 - Math.random() * 10;
        buildingLeft.position.z = zPos;
        scenery.add(buildingLeft);

        const buildingRight = createBuilding();
        buildingRight.position.x = ROAD_WIDTH / 2 + 15 + Math.random() * 10;
        buildingRight.position.z = zPos;
        scenery.add(buildingRight);
    }

    // Street Lights
    const createStreetLight = () => {
        const lightGroup = new THREE.Group();
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 7, 8);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 3.5;
        pole.castShadow = true;
        lightGroup.add(pole);

        const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 8);
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.rotation.z = Math.PI / 4;
        arm.position.set(1, 6.5, 0);
        arm.castShadow = true;
        lightGroup.add(arm);

        const lightGeo = new THREE.BoxGeometry(0.4, 0.3, 0.4);
        const lightMat = new THREE.MeshLambertMaterial({ color: 0x333333, emissive: 0xffffaa, emissiveIntensity: 0.5 });
        const lightBox = new THREE.Mesh(lightGeo, lightMat);
        lightBox.position.set(1.8, 6.2, 0);
        lightGroup.add(lightBox);
        return lightGroup;
    }
    
    for (let i = 0; i < 10; i++) {
        const zPos = (i * 40) - ROAD_LENGTH;
        const lightLeft = createStreetLight();
        lightLeft.position.set(-ROAD_WIDTH/2 - 1.5, 0, zPos);
        scenery.add(lightLeft);
        
        const lightRight = createStreetLight();
        lightRight.rotation.y = Math.PI;
        lightRight.position.set(ROAD_WIDTH/2 + 1.5, 0, zPos);
        scenery.add(lightRight);
    }
    
    // Traffic Lights
    const createTrafficLight = () => {
        const group = new THREE.Group();
        const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 8, 12);
        const poleMat = new THREE.MeshLambertMaterial({color: 0x666666});
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 4;
        pole.castShadow = true;
        group.add(pole);
    
        const housingGeo = new THREE.BoxGeometry(0.5, 1.7, 0.5);
        const housingMat = new THREE.MeshLambertMaterial({color: 0x333333});
        const housing = new THREE.Mesh(housingGeo, housingMat);
        housing.position.set(0, 7, 0);
        housing.castShadow = true;
        group.add(housing);
    
        const lightGeo = new THREE.CircleGeometry(0.15, 16);
        const redMat = new THREE.MeshBasicMaterial({color: 0xff0000});
        const yellowMat = new THREE.MeshBasicMaterial({color: 0xffff00});
        const greenMat = new THREE.MeshBasicMaterial({color: 0x00ff00});
    
        const redLight = new THREE.Mesh(lightGeo, redMat);
        redLight.position.set(0, 7.6, 0.26);
        group.add(redLight);
        
        const yellowLight = new THREE.Mesh(lightGeo, yellowMat);
        yellowLight.position.set(0, 7.1, 0.26);
        group.add(yellowLight);
    
        const greenLight = new THREE.Mesh(lightGeo, greenMat);
        greenLight.position.set(0, 6.6, 0.26);
        group.add(greenLight);
    
        return group;
    }
    
    const trafficLight1 = createTrafficLight();
    trafficLight1.position.set(ROAD_WIDTH / 2 + 1.5, 0, -50);
    trafficLight1.rotation.y = -Math.PI / 2;
    scenery.add(trafficLight1);
    
    const trafficLight2 = createTrafficLight();
    trafficLight2.position.set(-ROAD_WIDTH / 2 - 1.5, 0, -150);
    trafficLight2.rotation.y = Math.PI / 2;
    scenery.add(trafficLight2);

    scene.add(scenery);

    // Enemy Cars
    const createEnemyCar = (color: THREE.ColorRepresentation) => {
        const car = new THREE.Group();
        const bodyMat = new THREE.MeshLambertMaterial({ color });
        const bodyGeo = new THREE.BoxGeometry(2.2, 1, 4.5);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        body.castShadow = true;
        car.add(body);
    
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
        const cabinGeo = new THREE.BoxGeometry(1.8, 0.9, 2.5);
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.y = 1.45;
        cabin.position.z = -0.3;
        cabin.castShadow = true;
        car.add(cabin);
        
        return car;
    }

    const enemies: { mesh: THREE.Group, bbox: THREE.Box3 }[] = [];
    for (let i = 0; i < NUM_ENEMIES; i++) {
        const enemy = createEnemyCar(ENEMY_COLORS[i % ENEMY_COLORS.length]);
        resetEnemy(enemy);
        scene.add(enemy);
        enemies.push({ mesh: enemy, bbox: new THREE.Box3().setFromObject(enemy) });
    }

    // Coins
    const createLightRayTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) return null;

        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0.2, 'rgba(255, 220, 100, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 200, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 160, 0, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(canvas);
    }
    const lightRayTexture = createLightRayTexture();
    
    const createCoinTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.fillStyle = '#c9a100'; // Darker gold for background
        context.beginPath();
        context.arc(64, 64, 64, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#ffff00'; // Yellow outline
        context.lineWidth = 5;
        context.stroke();
        context.font = 'bold 90px Arial';
        context.fillStyle = '#ffd700'; // Gold for the sign
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = "rgba(0,0,0,0.5)";
        context.shadowBlur = 10;
        context.fillText('$', 64, 70);
        return new THREE.CanvasTexture(canvas);
    };
    const coinFaceTexture = createCoinTexture();

    const coins: { mesh: THREE.Mesh, bbox: THREE.Box3 }[] = [];
    const coinGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 24);
    const coinMaterials = [
        new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 }), // Side
        new THREE.MeshStandardMaterial({ map: coinFaceTexture, metalness: 0.8, roughness: 0.3 }), // Top
        new THREE.MeshStandardMaterial({ map: coinFaceTexture, metalness: 0.8, roughness: 0.3 }), // Bottom
    ];
    
    for (let i = 0; i < NUM_COINS; i++) {
        const coin = new THREE.Mesh(coinGeometry, coinMaterials);
        coin.rotation.x = Math.PI / 2; // Stand the coin up
        coin.rotation.y = Math.PI; // Face the camera
        coin.castShadow = true;

        if (lightRayTexture) {
            const spriteMaterial = new THREE.SpriteMaterial({
                map: lightRayTexture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
            });
            const lightRaySprite = new THREE.Sprite(spriteMaterial);
            lightRaySprite.scale.set(4, 4, 1);
            coin.add(lightRaySprite);
        }

        resetCoin(coin);
        scene.add(coin);
        coins.push({ mesh: coin, bbox: new THREE.Box3().setFromObject(coin) });
    }

    function resetEnemy(enemy: THREE.Group) {
        const lane = Math.floor(Math.random() * 3) - 1;
        enemy.position.set(lane * LANE_WIDTH, 0, -(Math.random() * 100 + 50));
    }

    function resetCoin(coin: THREE.Mesh) {
        const lane = Math.floor(Math.random() * 3) - 1;
        coin.position.set(lane * LANE_WIDTH, 1.2, -(Math.random() * 80 + 120));
    }

    // Controls and Interaction
    const handleKeyDown = (event: KeyboardEvent) => {
        initAudioOnce();
        keysPressed.current[event.key.toLowerCase()] = true; 
    };
    const handleKeyUp = (event: KeyboardEvent) => { keysPressed.current[event.key.toLowerCase()] = false; };
    const handlePointerDown = () => initAudioOnce();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);


    // Resize handler
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    let isGameOver = false;

    const animate = () => {
        if (isGameOver) return;
        animationFrameId = requestAnimationFrame(animate);
        
        // Update car speed based on input
        const doAccelerate = keysPressed.current['arrowup'] || keysPressed.current['w'] || accelerateRef.current;
        const doBrake = keysPressed.current['arrowdown'] || keysPressed.current['s'] || brakeRef.current;

        if (doAccelerate) {
            currentSpeed.current = Math.min(MAX_SPEED, currentSpeed.current + ACCELERATION);
        } else if (doBrake) {
            currentSpeed.current = Math.max(0, currentSpeed.current - BRAKING_FORCE);
        } else {
            currentSpeed.current = Math.max(0, currentSpeed.current - DECELERATION);
        }

        // Update engine sound
        if (engineSoundRef.current && audioContextRef.current) {
            const { oscillator, gain } = engineSoundRef.current;
            const targetFrequency = 60 + (currentSpeed.current / MAX_SPEED) * 140; // 60Hz to 200Hz
            const targetVolume = 0.1 + (currentSpeed.current / MAX_SPEED) * 0.3; // 0.1 to 0.4
            const currentTime = audioContextRef.current.currentTime;
            
            oscillator.frequency.setTargetAtTime(targetFrequency, currentTime, 0.1);
            gain.gain.setTargetAtTime(targetVolume, currentTime, 0.1);
        }

        // Move scenery
        scenery.position.z += currentSpeed.current;
        if (scenery.position.z > ROAD_LENGTH) {
            scenery.position.z -= ROAD_LENGTH;
        }

        // Move clouds for parallax effect
        clouds.position.z += currentSpeed.current * 0.1;
        if (clouds.position.z > ROAD_LENGTH * 2) {
            clouds.position.z -= ROAD_LENGTH * 2;
        }


        // Handle player movement
        if (playerCar) {
            let move = 0;
            if (keysPressed.current['arrowleft'] || keysPressed.current['a']) move = -1;
            if (keysPressed.current['arrowright'] || keysPressed.current['d']) move = 1;
            if (moveDirectionRef.current !== 0) move = moveDirectionRef.current;
            
            playerCar.position.x += move * PLAYER_SPEED;
            playerCar.position.x = THREE.MathUtils.clamp(playerCar.position.x, -LANE_WIDTH, LANE_WIDTH);
            
            playerBBox.setFromObject(playerCar);
        }

        // Move enemies
        enemies.forEach(enemy => {
            enemy.mesh.position.z += currentSpeed.current * ENEMY_SPEED_MULTIPLIER;
            if (enemy.mesh.position.z > camera.position.z + 5) {
                resetEnemy(enemy.mesh);
            }
            enemy.bbox.setFromObject(enemy.mesh);

            if (playerCar && playerBBox.intersectsBox(enemy.bbox)) {
                isGameOver = true;
                // Fade out engine sound on game over
                if (engineSoundRef.current && audioContextRef.current) {
                    const { gain } = engineSoundRef.current;
                    gain.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.1);
                }
                onGameOver();
            }
        });

        // Move coins
        coins.forEach(coin => {
            coin.mesh.position.z += currentSpeed.current;

            if (coin.mesh.position.z > camera.position.z + 5) {
                resetCoin(coin.mesh);
            }
            coin.bbox.setFromObject(coin.mesh);

            if (playerCar && playerBBox.intersectsBox(coin.bbox)) {
                scoreRef.current += 10;
                onScoreUpdate(scoreRef.current);
                playCoinSound();
                resetCoin(coin.mesh);
            }
        });

        renderer.render(scene, camera);
    };

    animate();

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('mousedown', handlePointerDown);
        window.removeEventListener('touchstart', handlePointerDown);
        window.removeEventListener('resize', handleResize);

        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.error);
        }
        engineSoundRef.current = null;
        
        if (mountRef.current) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            mountRef.current.removeChild(renderer.domElement);
        }
        cancelAnimationFrame(animationFrameId);
        // Dispose Three.js objects
        scene.traverse(object => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        renderer.dispose();
    };
  }, [onGameOver, onScoreUpdate, moveDirectionRef, accelerateRef, brakeRef, carColor]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default Game;
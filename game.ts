import {off} from 'process';
// import * as THREE from 'three'
import {
    AnimationClip,
    AnimationMixer, Box3, BoxGeometry, BoxHelper,
    Clock,
    CubeReflectionMapping,
    Group, HemisphereLight,
    InterpolateDiscrete,
    LoopOnce,
    LoopPingPong,
    LoopRepeat, MathUtils, Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    MirroredRepeatWrapping, Object3D,
    PerspectiveCamera, PlaneGeometry,
    PMREMGenerator, PointLight,
    Scene,
    TextureLoader,
    Vector2,
    Vector3,
    VectorKeyframeTrack, WebGLRenderer,
    ZeroCurvatureEnding,
} from 'three';

import {Water} from './objects/water'
import {Sky} from './objects/sky.js'
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {radToDeg} from "three/src/math/MathUtils";
import {WaterOptions} from "three/examples/jsm/objects/Water";
const scene = new Scene()

const destructionBits = new Array<Mesh>();

const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
)
camera.position.z = 115;
camera.position.y = 60;
camera.rotation.x = -0.5;
// camera.position.x = 20

const renderer = new WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const geometry = new BoxGeometry(25, 1, 3);
const material = new MeshStandardMaterial({
    color: 0x964B00,
    wireframe: false,
    // opacity: 0.4,
    transparent: false,
});

let backgroundBitCount = 0;
let challengeRowCount = 0;


const waterGeometry = new PlaneGeometry(10000, 10000);
const speedOffset = performance.now();

const gltfLoader = new GLTFLoader();

const water = new Water(
    waterGeometry,
    {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new TextureLoader().load('waternormals.jpeg', function (texture) {

            texture.wrapS = texture.wrapT = MirroredRepeatWrapping;
            // texture.offset = new Vector2(speed, speed);

        }),
        sunDirection: new Vector3(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    }
) as any;

const platforms = new Array<Mesh>();
const environmentBits = new Array<Object3D>();

let platformsMoving = false;
// let offset = 4.0;
let speed = 0.50;
let distance = 0.0;
let leftPressed = false;
let rightPressed = false;

let rocketModel : Object3D;
let cliffsModel : Object3D;
let crystalModel : Object3D;
let rockModel : Object3D;
let shieldModel : Object3D;

let challengeRows = new Array<ChallengeRow>();

let sceneReady = false;


window.addEventListener('resize', onWindowResize, false)

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    render()
}

function animate() {
    // if (!sceneReady) return;
    requestAnimationFrame(animate);
    if (leftPressed && rocketModel.position.x > -30){
        console.log(rocketModel.position.x);
        rocketModel.position.x -= 0.5;
    }
     if (rightPressed && rocketModel.position.x < 30){
        rocketModel.position.x += 0.5;
    }

    // water.material.uniforms['speed'].value += 0.001;
    // camera.position.z -= 0.5;
    if (platformsMoving) {
        speed += 0.00001;
        // offset += speed;
        distance += speed;
    }

    if (sceneReady){
        if (environmentBits.length == 0){
            addBackgroundBit(0);
        }
        if (environmentBits[0].position.z > -1300){
            addBackgroundBit(backgroundBitCount++);
            // debugger;
        }
        if (challengeRows.length == 0){
            addChallengeRow(0);
        }
        if (challengeRows[0].rowParent.position.z > -1300){
            console.log(`rowparent for challenge row is ${challengeRows[0].rowParent.position.z}`);
            addChallengeRow(challengeRowCount++);
        }
        renderer.render(scene, camera);
        platforms.forEach(mesh => {
            if (platformsMoving) {
                mesh.position.z += speed;
            }
            if (mesh.userData.clock && mesh.userData.mixer) {
                mesh.userData.mixer.update(mesh.userData.clock.getDelta());
            }

        });

        destructionBits.forEach(mesh => {
            if (mesh.userData.clock && mesh.userData.mixer){
                // debugger;
                mesh.userData.mixer.update(mesh.userData.clock.getDelta());



                // if (mesh.position == rocketModel.position){
                //     console.log('removing destruction bit...');
                // }
            }
        });


        if (platformsMoving){
            detectCollisions();
            for (var i = 0; i < environmentBits.length; i++){
                let mesh = environmentBits[i];
                // if (mesh.position.z > 100){
                //     scene.remove(mesh);
                //     environmentBits.splice(i, 1);
                //     console.log('removed out of viewport rock thing');
                //     // addBackgroundBit(40);
                //     // addBackgroundBit(backgroundBitCount++);
                // }
                // else{
                mesh.position.z += speed;
                // }
            }
            for (var i = 0; i < challengeRows.length ; i++){
                challengeRows[i].rowParent.position.z += speed;
                // challengeRows[i].rowObjects.forEach(x => {
                //     x.position.z += speed;
                // })
            }
    }
        moveCollectedBits();
        garbageCollector();

    }



    render()
}

const moveCollectedBits = () => {
    destructionBits.forEach(x => {
        let targetPosition = rocketModel.position;
        let targetNormalizedVector = new Vector3(0,0,0);
        targetNormalizedVector.x = targetPosition.x - x.position.x;
        targetNormalizedVector.y = targetPosition.y - x.position.y;
        targetNormalizedVector.z = targetPosition.z - x.position.z;
        targetNormalizedVector.normalize();
        x.translateOnAxis(targetNormalizedVector, 0.5);
        // let target = rocketModel.position.normalize();

    })
}

const garbageCollector = () => {
    let environmentObjectsForCollection = environmentBits.filter(x => x.position.z > 100);
    let challengeRowsForCollection = challengeRows.filter(x => x.rowParent.position.z > 100);

    // if (environmentObjectsForCollection.length){
        for (let i = 0; i < environmentObjectsForCollection.length - 1; i++){
            let environmentObjectIndex = environmentBits.indexOf(environmentObjectsForCollection[i]);
            scene.remove(environmentBits[environmentObjectIndex]);
            environmentBits.splice(environmentObjectIndex, 1);

            console.log(`Removing environment object at index ${i} from scene`);
        }

        for (let i = 0; i< challengeRowsForCollection.length - 1; i++){
            // debugger;
            let challengeRowIndex = challengeRows.indexOf(challengeRowsForCollection[i]);
            scene.remove(challengeRowsForCollection[i].rowParent);
            // challengeRowsForCollection[i].rowParent.remove();
            // challengeRowsForCollection[i].rowObjects.forEach(x => {
            //     scene.remove(x);
            // });

            console.log(`Removing challenge line at index ${i} from scene`);

            challengeRows.splice(challengeRowIndex, 1);

        }

        // let environmentObjectIndex = environmentBits.indexOf()
    // }

}

function render() {
    (water.material).uniforms['time'].value += 1 / 60.0;
    if (platformsMoving){
        (water.material as any).uniforms['speed'].value += (performance.now() - speedOffset) / 10000000.0;
        // console.log(speedClock.elapsedTime);
    }

}

function configureWater() {
    water.rotation.x = -Math.PI / 2;
    water.rotation.z = 180;
    // water.receiveShadow = true;
    // water.position.x = 2;

    scene.add(water);
}

// movement - please calibrate these values
// movement - please calibrate these values
var xSpeed = 0.5;
var ySpeed = 0.5;

function onKeyDown(event : KeyboardEvent) {
    console.log('keypress');
    let keyCode = event.which;
    if (keyCode == 37) {
        leftPressed = true;
    } else if (keyCode == 39) {
        rightPressed = true;
    }
}

function onKeyUp(event: KeyboardEvent) {
    let keyCode = event.which;
    if (keyCode == 37) {
        leftPressed = false;
    } else if (keyCode == 39) {
        rightPressed = false;
    }

}

const addBackgroundBit = (count: number) => {
    console.log('adding ' + count);
    let thisRock = cliffsModel.clone();
    // debugger;
    thisRock.scale.set(0.02, 0.02, 0.02);
    thisRock.position.set(count % 2 == 0 ? 60 - Math.random() : -60 - Math.random(), 0, -(count * 60));
    thisRock.rotation.set(MathUtils.degToRad(-90), 0, Math.random());
    // thisRock.traverse((object => {
    //     if(object.isMesh)
    // }))
    // thisRock.castShadow = true;
    // thisRock.receiveShadow = true;
    // thisRock.traverse((object => obj))
    scene.add(thisRock);
    // environmentBits.push(thisRock);
    environmentBits.unshift(thisRock);// add to beginning of array
}

const addChallengeRow = (index: number) => {
    console.log(`creating challenge row ${index}`);
    let zOffset = -(index * 60);
    let rowGroup = new Group();
    rowGroup.position.z = zOffset;
    // let challengeRow = new Array<Object3D>();
    for (let i = 0; i < 5 ;i++){
        const random = Math.random() * 10; // number between 1 and 10
        // let crystal = objectLoader(index, ObjectType.CRYSTAL);
        if (random < 2){
            let crystal = addCrystal(i);

            // crystal.updateMatrixWorld();
            rowGroup.add(crystal);
            // challengeRow.push(addCrystal(challengeRowCount, i, zOffset));
        }
         else if (random < 4){
            let rock = addRock(i);
            rowGroup.add(rock);
            // debugger;
            // let rock = add
        }
         else if (random > 9){
             let shield = addShield(i);
             rowGroup.add(shield);
        }
    }
    challengeRows.unshift({rowParent: rowGroup, index: challengeRowCount++});
    // debugger;
    scene.add(rowGroup);
}

const addCrystal = (rowCell: number) => {
    let crystal = crystalModel.clone();
    // crystal.position.z = zOffset;
    crystal.position.x = rowCell * 10;
    crystal.scale.set(0.02, 0.02, 0.02);
    // attachBoundingBox(`boundingBox-crystal-${rowCell}`, 10, crystal);
    // scene.add(crystal);
    return crystal;
}

const addRock = (rowCell: number) => {
    let rock = rockModel.clone();
    rock.position.x = rowCell * 10;
    rock.scale.set(5,5,5);
    rock.position.setY(5);
    rock.castShadow = true;
    rock.receiveShadow = true;
    // attachBoundingBox(`boundingBox-rock-${rowCell}`, 8, rock);
    // rock.scale.set(0.02, 0.02, 0.02);
    return rock;
}

const addShield = (rowCell: number) => {
    let shield = shieldModel.clone();
    shield.position.x = rowCell * 10;
    shield.position.y = 8;
    // attachBoundingBox(`boundingBox-shield-${rowCell}`, 10, shield);
    return shield;
}


const objectLoader = (index: number, type: ObjectType) => {
    let model: Object3D;

    switch (type){
        case ObjectType.ROCK:
            model = rockModel.clone();
            break;
        case ObjectType.CRYSTAL:
            model = crystalModel.clone();
            break;
        case ObjectType.SHIELD_ITEM:
            model = shieldModel.clone();
            break;
    }
    model.position.x = index * 10;
    return model;

}

                      enum ObjectType{
    ROCK,
                          CRYSTAL,
                          SHIELD_ITEM
                      }

const rocketGLTF = 'models/rocket/scene.gltf';
const cliffsGLTF = 'models/cliffs/scene.gltf';
const crystalsGLTF = 'models/glowing_crystals/scene.gltf';
const rockGLTF = 'models/glowing_rock/scene.gltf';
const shieldGLTF = 'models/shield_item/scene.gltf';



async function sceneSetup() {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = true;
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    // gltfLoader.load(rocketGLTF, (model) =>{
    //     // model.scene.scale.set(10, 10, 10);
    //
    //     // boundingMesh.position.z = 70;
    //     // let collisionBox = CubeMe
    // });

    cliffsModel = (await gltfLoader.loadAsync(cliffsGLTF)).scene.children[0];
    crystalModel = (await gltfLoader.loadAsync(crystalsGLTF)).scene.children[0];
    rockModel = (await gltfLoader.loadAsync(rockGLTF)).scene.children[0];
    shieldModel = (await gltfLoader.loadAsync(shieldGLTF)).scene.children[0];
    rocketModel = (await gltfLoader.loadAsync(rocketGLTF)).scene.children[0];
    sceneReady = true;
    rocketModel.scale.set(0.3,0.3,0.3);
    // rocket.
    scene.add(rocketModel);
    rocketModel.rotateZ(3.1);
    rocketModel.rotateX(1.8);
    rocketModel.position.z = 70;
    rocketModel.position.y = 10;

    const rocketBoundingGeometry = new BoxGeometry(5, 5, 5);
    const rocketBoundingMaterial = new MeshStandardMaterial({
        color: 0x964B00,
        wireframe: true,
        // opacity: 0.4,
        transparent: false,
    });

    // let boundingMesh = scene.add(new Mesh(rocketBoundingGeometry, rocketBoundingMaterial));

    // rocketBoundingBox = new Mesh(rocketBoundingGeometry, rocketBoundingMaterial);
    // rocketBoundingBox.position.z = 70;
    // rocketBoundingBox.position.y = 10;
    // rocketBoundingBox.name = 'rocketBoundingBox';

    // rocketBoundingBox.parent = rocketModel;
    // scene.add(rocketBoundingBox);
    // rocketModel.attach(rocketBoundingBox);
    let rocketLight = new PointLight(0xffffff, 5);
    rocketModel.attach(rocketLight);
    scene.add(rocketLight);
    // rocketLight.intensity = 5;
    rocketLight.rotation.z = -0.2;
    rocketLight.position.x = 5;
    rocketLight.castShadow = true;
    rocketModel.receiveShadow = true;

    // rocketLight.castShadow = true;

    // fbxLoader.load('models/source/9d7ea369abab47818f8024e5905fa3a2.fbx.fbx', (object => {
    //     scene.add(object);
    //     // object.rotation.x = 3.14 / 2;
    //     object.rotation.y = 3.14 / 2;
    //
    //     // object.rotation.x = 45;
    //
    //     object.position.z = 50;
    //
    //     // object.rotation
    // }), (progress => {
    //
    // }), (error => {
    //     console.error(error);
    // }));
    const sun = new Vector3();
    const light = new HemisphereLight(0xffffff, 0x444444, 1.0);
    light.position.set(0, 1, 0);
    scene.add(light);
    //
    // clight = new DirectionalLight(0xffffff, 1.0);
    // light.position.set(0, 1, 0);
    // scene.add(light);

    // Water
    configureWater();

    // Skybox

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = (sky.material as any).uniforms;

    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    const parameters = {
        elevation: 3,
        azimuth: 115
    };

    const pmremGenerator = new PMREMGenerator(renderer);

    function updateSun() {

        const phi = MathUtils.degToRad(90 - parameters.elevation);
        const theta = MathUtils.degToRad(parameters.azimuth);

        sun.setFromSphericalCoords(1, phi, theta);

        (sky.material as any).uniforms['sunPosition'].value.copy(sun);
        (water.material as any).uniforms['sunDirection'].value.copy(sun).normalize();

        // scene.environment = pmremGenerator.fromScene(sky).texture;
        scene.environment = pmremGenerator.fromScene(sky as any).texture;
    }

    updateSun();
    (water.material as any).uniforms['speed'].value = 0.0;

    // const material = new MeshStandardMaterial({
    //     color: 0x964B00,
    //     wireframe: false,
    //     // opacity: 0.4,
    //     transparent: false,
    // });


    // let rock = rockScene.scene.children[0];


    // for (var i = 0; i < 20; i++){
    //     addBackgroundBit(i);
    //     backgroundBitCount++;
    // }


    await startupAnimation();
    console.log('done');
    platformsMoving = true;
    // speedClock.start();
    platforms.forEach(mesh => {
        // let track = new VectorKeyframeTrack('.position', [0, 1], [
        //     0,
        //     0,
        //     mesh.userData.offset,
        //     0,
        //     0,
        //     mesh.userData.offset * 2,
        // ]);

        // const animationClip = new AnimationClip('animateIn', 5, [track]);
        // const animationAction = mesh.userData.mixer.clipAction(animationClip);
        // animationAction.setLoop(LoopRepeat);
        // animationAction.play();
        // animationAction.clampWhenFinished = true;
    });
}


const startupAnimation = async () => {
    for (var i = 0; i < 20; i++) {
        addNewPlatform(i, i / 5, i);
        // const cube = new Mesh(geometry, material);
        // cube.userData.mixer = new AnimationMixer(cube);
        // let track = new VectorKeyframeTrack('.position', [0, 1.4, 2], [
        //     i % 2 === 0 ? 80 : -80,
        //     0,
        //     i * 4,
        //     i % 2 === 0 ? -5 : 5,
        //     0,
        //     i * 4,
        //     0,
        //     0,
        //     i * 4,
        // ]);

        // const animationClip = new AnimationClip('animateIn', 5, [track]);
        // const animationAction = cube.userData.mixer.clipAction(animationClip);
        // animationAction.setLoop(LoopOnce);
        // animationAction.clampWhenFinished = true;

        // // animationAction.startAt(i * 10);
        // animationAction.startAt(i / 5);

        // animationAction.play();
        // cube.userData.clock = new Clock();
        // cube.userData.offset = i * 4;

        // platforms.push(cube);
        // scene.add(cube);
    }
    return wait(8000);
    // return Promise.delay(2000);
}

const addNewPlatform = (index: number, delay: number, offset: number) => {
    console.log('new platform ');
    const cube = new Mesh(geometry, material);
    cube.userData.mixer = new AnimationMixer(cube);
    let track = new VectorKeyframeTrack('.position', [0, 2 - speed, 2.1 - speed], [
        index % 2 === 0 ? 10 : -10, // x 1
        -10, // y 1
        offset * 4, // z 1
        0, // x 2
        0, // y 2
        offset * 4, // z 2
        0, // x 3
        0, // y 3
        offset * 4, // z 3
    ]);

    const animationClip = new AnimationClip('animateIn', 10, [track]);
    const animationAction = cube.userData.mixer.clipAction(animationClip);
    animationAction.setLoop(LoopOnce);
    animationAction.clampWhenFinished = true;

    animationAction.startAt(offset / 5);
    platforms.push(cube);
    scene.add(cube);
    animationAction.play();
    cube.userData.clock = new Clock();
    cube.userData.offset = index * 4;

    cube.userData.mixer.addEventListener('finished', function () {
        console.log('finished');
        // this.userData.animating = true;
    });
}

const detectCollisions = () => {
    // rocketBoundingBox.geometry.computeBoundingBox();
    // rocketBoundingBox.updateMatrixWorld();
    const rocketBox = new Box3().setFromObject(rocketModel);
    challengeRows.forEach(x => {
        x.rowParent.updateMatrixWorld();
        // console.log(x.rowParent.children);
        x.rowParent.children.forEach(y => {
            y.children.forEach(z => {
                const box = new Box3().setFromObject(z);
                if (box.intersectsBox(rocketBox)){
                    console.log('collision!');
                    let destructionPosition = box.getCenter(z.position);
                    playDestructionAnimation(destructionPosition);
                    y.remove(z);
                    // playDestructionAnimation()
                    // scene.remove(z);
                }
            });
        })
    });
}

const playDestructionAnimation = (spawnPosition: Vector3) => {
    for (let i = 0; i < 6; i++){
        // let group = new Group();
        let destructionBit = new Mesh(new BoxGeometry(1 ,1, 1), new MeshBasicMaterial({color: 'black', transparent: true, opacity: 0.4}));
        destructionBit.position.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
        // group.add(destructionBit);
        destructionBit.userData.mixer = new AnimationMixer(destructionBit);
        // let mixer =

        let degrees = i / 45;

        let spawnX = Math.cos(radToDeg(degrees)) * 15;
        let spawnY = Math.sin(radToDeg(degrees)) * 15;



        let track = new VectorKeyframeTrack('.position', [0, 0.3], [
            rocketModel.position.x, // x 3
            rocketModel.position.y, // y 3
            rocketModel.position.z, // z 3
            rocketModel.position.x + spawnX, // x 2
            rocketModel.position.y, // y 2
            rocketModel.position.z + spawnY, // z 2
        ]);

        const animationClip = new AnimationClip('animateIn', 10, [track]);
        const animationAction = destructionBit.userData.mixer.clipAction(animationClip);
        animationAction.setLoop(LoopOnce, 1);
        animationAction.clampWhenFinished = true;
        animationAction.play();
        destructionBit.userData.clock = new Clock();
        destructionBit.userData.mixer.addEventListener('finished', function () {
            console.log('finished animating destruction bit');
            // this.userData.animating = true;
        });

        scene.add(destructionBit);

        destructionBits.push(destructionBit);

    }
}

// const attachBoundingBox = (name: string, size: number, parent: Object3D) => {
//     let box = new BoxHelper(parent, 'white');
//     // scene.add(box);
//     // const boundingGeometry = new BoxGeometry(size, size, size);
//     // const boundingMaterial = new MeshStandardMaterial({
//     //     color: 'white',
//     //     wireframe: true,
//     //     // opacity: 0.4,
//     //     transparent: false,
//     // });
//     // const boundingBox = new BoxGeometry(size, size, size);
//     // const boundingMesh = new Mesh(boundingGeometry, boundingMaterial);
//     // boundingMesh.name = name;
//     // parent.attach(boundingMesh);
//     // parent.updateMatrixWorld();
//     // boundingMesh.position.set(0,0,0);
//
// }


const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

sceneSetup();
animate()

interface ChallengeRow{
    index: number;
    rowParent: Group;
    // zOffset: number;

}

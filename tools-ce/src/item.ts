import {
  TweenSystem,TweenSystemMove,TweenSystemRotate,TweenSystemScale,
  Tweenable,TweenableMove,TweenableRotate,TweenableScale,
  RepeatActionType,SceneChangeAddRmType,
  Tween,
  Syncable,
  TweenType,
  CurveType,
  PathData,
  RotateData,
  TweenableVO,
} from './tween'
import { setTimeout, DelaySystem } from './delay'
import { Animated, AnimType } from './animation'
import { getEntityWorldPosition, getEntityWorldRotation } from './decentralandecsutils/helpers/helperfunctions'

export type Props = {}

type DelayValues = {
  timeout: number
  onTimeout: Actions
}

type PrintValues = {
  message: string
  duration: number
  multiplayer: boolean
}

type AnimationValues = {
  target: string
  animAction: string
  speed: number
  loop: boolean
  animation?: string
}

type SyncEntityTween = 
  { //must make 1 per type. move,scale,rotate
    transition: number
    type: TweenType
    curve: CurveType
    x: number
    y: number
    z: number
    w: number
    speed: number
    relative: boolean
    onComplete: Actions
    origin: Vector3
    originQ: Quaternion
    curvePoints: Vector3[]
    curveNBPoints: number  
    curveCloseLoop : boolean
    repeatAction: RepeatActionType
    sceneAddRemove: SceneChangeAddRmType //add to pass for syncable
    enabled: boolean
    numberOfSegments: number//for PathData and RotationData
    turnToFaceNext: boolean//for PathData and RotationData
    pathOriginIndex: number//for PathData and RotationData
    //TODO MUST ADD CURRENT PARENT?!?!
    //controlMode: string  enabled will handle it???? or must emit this removal?
    //tweenControlMove: boolean  enabled will handle it?
    //tweenControlRotate: boolean  enabled will handle it?
    //tweenControlScale: boolean , enabled will handle it?
    //TODO figure out how to remove these lock param
    lockX:boolean,//for PathData and RotationData
    lockY:boolean,//for PathData and RotationData
    lockZ:boolean,//for PathData and RotationData
    lockW:boolean,//for PathData and RotationData
  }

type SyncEntity = {
  entityName: string
  transform: {
    position: [number, number, number]
    rotation: [number, number, number, number]
    scale: [number, number, number]
  }
  tweenMove?: SyncEntityTween
  tweenRotate?: SyncEntityTween
  tweenScale?: SyncEntityTween
  anim?: {
    type: AnimType
    name: string
    speed: number
    loop: boolean
  }
}

function clone(x)
{
    if (x === null || x === undefined)
        return x;
    if (typeof x.clone === "function")
        return x.clone();
    if (x.constructor == Array)
    {
        var r = [];
        for (var i=0,n=x.length; i<n; i++)
            r.push(clone(x[i]));
        return r;
    }
    return x;
}

const syncv = (vector: Vector3, values: [number, number, number]) => {
  const [x, y, z] = values
  vector.set(x, y, z)
}

const syncq = (
  quaternion: Quaternion,
  values: [number, number, number, number]
) => {
  const [x, y, z, w] = values
  quaternion.set(x, y, z, w)
}


let onSceneReadyObservableExists = typeof onSceneReadyObservable !== 'undefined'
log("onSceneReadyObservable ")
log("onSceneReadyObservable: "+onSceneReadyObservableExists)

let tempLastHost = null;

const getEntityByName = (name: string) =>
  Object.keys(engine.entities)
    .map((key) => engine.entities[key])
    .filter((entity) => (entity as Entity).name === name)[0]

//taken from https://github.com/decentraland/decentraland-ecs-utils/blob/master/src/helpers/helperfunctions.ts


//leave player out here as static.  If I init it inside the method for some resaon the player position reports 0s first usage????
const player = Camera.instance

export default class Tools implements IScript<Props> {
  removedEntities: Record<string, IEntity> = {}
  canvas = new UICanvas()
  container: UIContainerStack
  debugEnabled: false //TODO allow configuing of this

  tweenSystem = new TweenSystem(Tweenable)
  tweenSystemMove = new TweenSystemMove()
  tweenSystemRotate = new TweenSystemRotate()
  tweenSystemScale = new TweenSystemScale()
  delaySystem = new DelaySystem()

  getContainer = () => {
    if (!this.container) {
      this.container = new UIContainerStack(this.canvas)
      this.container.width = 800
      this.container.height = '100%'
      this.container.hAlign = 'center'
      this.container.vAlign = 'bottom'
      this.container.positionY = 50
    }

    return this.container
  }
  init() {
    const version = "1.0.0.alpha"
    log("Toolbox-CE version " + version + " initializing... " )
    //tweenSystem = new TweenSystem()
    //engine.addSystem(this.tweenSystem)
    engine.addSystem(this.tweenSystemMove)
    engine.addSystem(this.tweenSystemRotate)
    engine.addSystem(this.tweenSystemScale)
    engine.addSystem(this.delaySystem)
    log("Toolbox-CE version " + version + " initializing DONE " )
  }

  getEntities() {
    //must union hidden in
    return this.tweenSystem.syncableGroup.entities as Entity[]
  }
  
  processControlAction<T extends TweenableVO>(type:string,entity:IEntity,controlMode:string,component:ComponentConstructor<T>){
    if(entity.hasComponent(component)){
      let tween = entity.getComponent(component)
      log("processControlAction   " + tween)
      //using enabled is good for now but should remove it to reduce processing
      if(controlMode=='pause'){
        tween.enabled = false
      }else if(controlMode=='resume'){
        tween.enabled = true
      }else if(controlMode=='stop'){
        entity.removeComponent(component)
      }
    }
    //TODO MUST EMIT???
  }

  adjustForSceneRotation(playerPosition:Vector3,entity:IEntity){
    //only do if took fresh positions
    let loopCnt = 0;
    let entPar:IEntity = entity
    let lastTransform:Transform = null;
    log("zNorth entPar "+loopCnt+" " + entPar+ " " + entPar.uuid)
    while(entPar != null && entPar.getParent() != null){
      entPar = entPar.getParent()
      
        log("entPar " +loopCnt+" " + entPar+ " " + entPar.uuid)
      if(entPar.hasComponent(Transform)){
        lastTransform = entPar.getComponent(Transform)
        log("entPar " +loopCnt+" got it from " + entPar + " " + entPar.uuid + " position " + lastTransform.position + " " + lastTransform.rotation.eulerAngles )
      }
      loopCnt++;
    }

    if(lastTransform != null && (lastTransform.position.x!=0 || lastTransform.position.y!=0 || lastTransform.position.z!=0)){
      playerPosition = playerPosition.rotate(lastTransform.rotation.conjugate())

      //TODO test on odd shaped parcel
      let parentRotEuler = lastTransform.rotation.eulerAngles
      //16,0,16 for 180 counter:16,0,16// 0,0,16 for 90, counter 16,0,0// 16,0,0 for -90 counter:0,0,16
      if(Math.abs(parentRotEuler.y) > 179 && Math.abs(parentRotEuler.y) < 181 ){
        playerPosition.addInPlace(lastTransform.position); //sum the adjusted x,z
      }else if(Math.abs(parentRotEuler.y) > 89 && Math.abs(parentRotEuler.y) < 91 ){
        playerPosition.addInPlace(new Vector3( lastTransform.position.z,lastTransform.position.y,lastTransform.position.z ));  //sum the flipped x,z
      }
    }else{
      log("adjustForSceneRotation no work needed")
    }
  }

  computeFaceAngle(lookAtTarget:Vector3,transform:Transform,lockMode:string,lockX:boolean,lockY:boolean,lockZ:boolean) {
   let lockW = false
  
    //START TESTING TO DETECT SDK

    //no help
    //froom builder
    //0,0:  facePlayer player rotate test:0.7933533402912352 3.727588677399492e-17 0.6087614290087207 4.85788814390261e-17 vs 0.7933533402912352 3.727588677399492e-17 0.6087614290087207 4.85788814390261e-17
    //from local
    //      facePlayer player rotate test:0.7933533402912352 3.727588677399492e-17 -0.6087614290087207 4.85788814390261e-17 vs 0.7933533402912352 3.727588677399492e-17 0.6087614290087207 4.85788814390261e-17

    let transformTemp = new Transform({
      rotation: Quaternion.Euler(180, 0, 0),//was y=75
    })
    transformTemp.rotate(Vector3.Up(), 75)
  
    let eulerTransform = Quaternion.Euler(180, 75, 0);
    let euler2StageRotate = transformTemp.rotation
  
    //compare rotations
    log("computeFaceAngle rotate test:" 
      + eulerTransform.x + " " + eulerTransform.y + " " + eulerTransform.z + " " + eulerTransform.w
      + " vs "
      + euler2StageRotate.x + " " + euler2StageRotate.y + " " + euler2StageRotate.z + " " + euler2StageRotate.w )
    //END TESTIN SDK DETECTION

    
    let direction = lookAtTarget.subtract(transform.position)
    let endRotation:Quaternion = Quaternion.Slerp(
      transform.rotation,
      Quaternion.LookRotation(direction),
      1
    )
    if(lockX||lockY||lockZ){
      let canUseEuler = lockMode != null && lockMode == 'euler';

      const endRotationEuler:Vector3 = endRotation.clone().eulerAngles;//.clone().eulerAngles

      if(canUseEuler){ //tthe builder is running sub 6.6.4 (6.6.3 i think) and has bug with euler angle conversion
        let startingRotationEuler:Vector3 = transform.rotation.eulerAngles;
        
        if(lockX) endRotationEuler.x=startingRotationEuler.x
        if(lockY) endRotationEuler.y=startingRotationEuler.y
        if(lockZ) endRotationEuler.z=startingRotationEuler.z
        //if(lockW) endRotationEuler.z=transform.rotation.w //consider converting lock vectors to euler then passing back q more user friendly
        //no work right in lower 6.6.4

        //let transformTemp = new Transform({
        //  rotation: Quaternion.Euler(endRotationEuler.x, 0, 0),//was y=75
        //})
        //transformTemp.rotate(Vector3.Up(), endRotationEuler.y)
        //transformTemp.rotate(Vector3.Forward(), endRotationEuler.z)
        
        endRotation = Quaternion.Euler(endRotationEuler.x,endRotationEuler.y,endRotationEuler.z)

        //endRotation = transformTemp.rotation
      }else{ //works in builder but not sure this is valid rotation lock logic
        if(lockX) endRotation.x=transform.rotation.x
        if(lockY) endRotation.y=transform.rotation.y
        if(lockZ) endRotation.z=transform.rotation.z
        if(lockW) endRotation.w=transform.rotation.w //consider converting lock vectors to euler then passing back q more user friendly
      }
    }
    return endRotation;
  }

  computeMoveVector(start:Vector3,endDest:Vector3,lockX:boolean,lockY:boolean,lockZ:boolean,percentOfDistanceToTravel:float,moveNoCloserThan:float){
    //Math.min(noCloserThanPercentage,percentDistance)
    let distanceWhole = Vector3.Distance(start, endDest)
    let distanceDelta = distanceWhole;

    if(moveNoCloserThan){
      distanceDelta=distanceWhole-moveNoCloserThan;
    }
    
    let endDestOrig=new Vector3().copyFrom(endDest)

    if(percentOfDistanceToTravel===undefined){
      percentOfDistanceToTravel = 1;
    }
    if(percentOfDistanceToTravel > 1){
      percentOfDistanceToTravel = percentOfDistanceToTravel/100
    }

    let percentStopDistToUse = 1;
    if(distanceDelta < 0){
      percentStopDistToUse = 0
      //dont move
      endDest = start.clone();
    }else if(distanceWhole > 0){
      percentStopDistToUse = distanceDelta/distanceWhole;
      percentStopDistToUse = Math.min(percentStopDistToUse,percentOfDistanceToTravel);
      endDest = Vector3.Lerp(start, endDest, percentStopDistToUse)

      if(lockX) endDest.x=start.x
      if(lockY) endDest.y=start.y
      if(lockZ) endDest.z=start.z
    }
    log("computeMoveVector " + start + " " + endDestOrig + " " + percentOfDistanceToTravel + " " + moveNoCloserThan + " " + distanceDelta + " returning " + endDest);
    return endDest;
  }
  spawn(host: Entity, props: Props, channel: IChannel) {

    /*
if(props.clickable){
      voxter.getEntity().addComponent(
            new OnPointerDown(
              () => {
                //if (this.active[host.name]) {
                  channel.sendActions(props.onClick)
                //}
              },
              {
                button: props.clickButton,
                hoverText: props.onClickText,
                distance: 6
              }
            )
          )
    }
    / auto start platform
    if (autoStart !== false) {
      const goToEndAction: BaseAction<{}> = {
        entityName: host.name,
        actionId: 'goToEnd',
        values: {}
      }
      channel.sendActions([goToEndAction])
    }
    */
    channel.handleAction<Tween>('sceneAddRemove', (action) => {
      const { target, sceneAddRemove, ...tween } = action.values
      log("sceneAddRemove called " + target + " to " + sceneAddRemove)
      let entity = getEntityByName(target)
      if(sceneAddRemove=='add'&&entity==null&&this.removedEntities[target]!=null){
        entity=this.removedEntities[target]
      }
      if (entity && entity !== undefined && sceneAddRemove == 'remove') {
        engine.removeEntity(entity);
        this.removedEntities[target]=entity;
      }else if(entity && sceneAddRemove=='add'){
        engine.addEntity(entity);
        delete this.removedEntities[target];
      }
      //todo add logging when cannot find object?!?!
      channel.sendActions(tween.onComplete)
    } )
    channel.handleAction<Tween>('attachToItem', (action) => {
      const { target, targetOfInterest,attachToOrigin, ...tween } = action.values
      log("attachToItem called " + target + " to " + targetOfInterest + " attachOrigin:" + attachToOrigin)
      const entityToAttach = getEntityByName(target)
      const entityTarget = getEntityByName(targetOfInterest)
      if (entityToAttach && entityTarget) {
        const transformParent = entityTarget.getComponent(Transform)
        const transformChild = entityToAttach.getComponent(Transform)

        const parentRotation = entityTarget.hasComponent(Transform)
            ? entityTarget.getComponent(Transform).rotation
            : Quaternion.Identity


        let onSceneReadyObservableExists = typeof onSceneReadyObservable !== 'undefined'
        log("onSceneReadyObservable ")
        log("onSceneReadyObservable: "+onSceneReadyObservableExists)

        if(attachToOrigin){
          let msg = "target origin pos before " + transformChild.position.x + " " + transformChild.position.y + " " + transformChild.position.z
          //transformChild.position.copyFrom(transformParent.position)
          //FIXME!!!
          transformChild.position = new Vector3(0,0,0)
          //transformChild.rotation = new Quaternion(0,0,0,0)
          //complete worrkaround for 6.6.3 must zero out position. must be flicker drawn before changing parent.  !?!?!?!
          //if dont position will report 0,0,0 but be positions at actual 0,0,0
          //not this one or is it doing it part of unity system loop???-
          //onSceneReadyObservable is 6.6.5
          //- Fetch the player’s camera mode from Camera.instance.cameraMode
          //events all new to 6.6.5?? https://docs.decentraland.org/development-guide/event-listeners/
          log(" REL utilsDelay fired in glass.ts holdding pre 0 then set for " + target)
              transformChild.position = new Vector3(0,0,0)
              //adding preserve roation broke it!?!?!
              entityToAttach.setParent(entityTarget);
              transformChild.rotation = transformChild.rotation.multiply(parentRotation.conjugate())
              transformChild.scale = transformChild.scale.divide(transformParent.scale)  
          log(msg + "| after " + transformChild.position.x + " " + transformChild.position.y + " " + transformChild.position.z)
          //TODO handle preserve scale, preserve rotation
          //transformChild.scale = transformChild.scale.divide(transformParent.scale)
        }else{
          //does not seem to help 6.3.3  probably cuz setting rotation!?!?!
          log(" ABS utilsDelay fired in glass.ts holdding pre 0 then set for " + target)
              //FIXME not right. it attaches but not rotated from center of item
              let vectorPos = transformChild.position.subtract(transformParent.position)
              //TODO ADD multiply by scale
              vectorPos = vectorPos.clone().rotate(parentRotation.conjugate()).divide(transformParent.scale)

              log("vectorPos rotate " + vectorPos);
                  //transformParent.position.subtract(transformAttach.position)

              //vectorPos = 
              transformParent.position.subtract(
                transformChild.position.clone().rotate(parentRotation))
              
              tempLastHost = entityTarget.getParent()
              log("last parent " + tempLastHost.name);
              transformChild.position = vectorPos
      
              transformChild.rotation = transformChild.rotation.multiply(parentRotation.conjugate())
              transformChild.scale = transformChild.scale.divide(transformParent.scale)
              entityToAttach.setParent(entityTarget);
          
        }
        
      }
      channel.sendActions(tween.onComplete)
    } )
    channel.handleAction<Tween>('detachFromItem', (action) => {
      const { target, targetOfInterest, ...tween } = action.values
      log("detachFromItem called " + target + " from " + targetOfInterest)
      
      const entityToDetach = getEntityByName(target)
      const entityTarget = getEntityByName(targetOfInterest)
      if (entityToDetach && entityTarget) {
        //must grab old value to put back
        let transformChild = entityToDetach.getComponent(Transform)
        let transformParent = entityTarget.getComponent(Transform)
        //TODO only detatch if is its parent
        log("last parent " + tempLastHost.name);
        
        let parentRotation = entityTarget.hasComponent(Transform)
          ? entityTarget.getComponent(Transform).rotation
          : Quaternion.Identity
          
        //returns 0 every time?!?!
        //transformDetach.rotation.multiplyInPlace( transformTarget.rotation ) ;//getEntityWorldRotation(entityToDetach) );//transformTarget.rotation );
        //transformDetach.rotation = getEntityWorldRotation(entityToDetach);//transformTarget.rotation );
        transformChild.rotation = getEntityWorldRotation(entityToDetach);//transformChild.rotation.multiply(parentRotation)
          
        log("rotation " + transformChild.eulerAngles);

        //drops position well
        transformChild.position = getEntityWorldPosition(entityToDetach)
        transformChild.scale = transformChild.scale.multiply(transformParent.scale)
        
        entityToDetach.setParent(tempLastHost)
        
      }
      channel.sendActions(tween.onComplete)
    } )
    
    channel.handleAction<Tween>('followItemPath', (action) => {
      
      const { target, returnToFirst,numberOfSegments,turnToFaceNext,lockX,lockY,lockZ,lockW,pathItem1,pathItem2,pathItem3,pathItem4,pathItem5, ...tween } = action.values
      log("followItemPath called " + target + " sender " + action.sender + " ent name " + action.entityName)

      const sender = action.sender
      const entity = getEntityByName(target)

      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        let transform = entity.getComponent(Transform)

        log("followItemPath called")
        // how many points on the curve
        let curvePoints = Math.max(1,numberOfSegments)
        let closeLoop = returnToFirst

        // Compile these points into an array
        const cpoints = new Array()

        let pathItems = new Array();
        pathItems.push(pathItem1)
        pathItems.push(pathItem2)
        pathItems.push(pathItem3)
        pathItems.push(pathItem4)
        pathItems.push(pathItem5)

        //hacking using var to create signatureOfVectors
        let cpointsSignatureHack = new Vector3()
        
        for(var x=0;x<pathItems.length;x++){
          let itmName = pathItems[x];

          if(itmName === null || itmName === undefined){
          log("follow path " + x + " invalid item " + itmName );
            continue;
          }
          let pathEnt = getEntityByName(itmName);
          
          if(cpoints.length==0){//somehow linked to closeLoop
          //if((!closeLoop && cpoints.length==0) || (closeLoop && cpoints.length==0)){//somehow linked to closeLoop
            log("follow path " + x +" adding self to path " + target +  " point.len "+cpoints.length);
            cpoints.push(new Vector3().copyFrom(transform.position))//why must it be second and not first?!?!?
            cpointsSignatureHack.addInPlace(cpoints[cpoints.length-1])
          }
          if(pathEnt && pathEnt !== undefined){
            log("follow path " + x +" adding " + itmName + " point.len "+cpoints.length);
            cpoints.push(new Vector3().copyFrom(pathEnt.getComponent(Transform).position));
            cpointsSignatureHack.addInPlace(cpoints[cpoints.length-1])
          }
          
          
        }

        tween.x=cpointsSignatureHack.x
        tween.y=cpointsSignatureHack.y
        tween.z=cpointsSignatureHack.z

        action.values.x=tween.x
        action.values.y=tween.y
        action.values.z=tween.z

        if (entity.hasComponent(TweenableMove)) {
          let existingTweenble = entity.getComponent(TweenableMove)
          if (
            existingTweenble.sender !== action.sender &&
            existingTweenble.type == 'follow-path' &&
            currentTime - existingTweenble.timestamp < 500 &&
            existingTweenble.x === action.values.x && //TODO COMPARE ALL cpoints same cancel instead using cpointsSignatureHack
            existingTweenble.y === action.values.y &&
            existingTweenble.z === action.values.z
          ) {
            log("OOTB follow-path same tween already in progress? " + action.sender + " " + action.actionId + " " + action.entityName + " " + target + " " + tween.x + " " + tween.y + " " + tween.z)
            //return
          }
        }

        // Create a Catmull-Rom Spline curve. This curve passes through all 4 points. The total number of points in the path is set by  `curvePoints`
        //let catmullPath = Curve3.CreateCatmullRomSpline(cpoints, curvePoints, closeLoop).getPoints()

        //tween.curvePath = catmullPath;
        //must construct path to follow
        
        let entityTransform = null;
        if(entity.hasComponent(Transform)){
          entityTransform = entity.getComponent(Transform)
        }else{
          log("follow-path " + target + " does not have Transform?!?!")
        }

        const origin = entityTransform.position.clone()
        const originQ:Quaternion=entityTransform.rotation.clone();
        const tweenable = new TweenableMove({
          //const tweenable = new Tweenable({
          ...tween,
          type: 'follow-path',
          channel,
          origin,
          originQ,
          sender,
          curvePoints: cpoints,
          curveNBPoints: curvePoints,
          curveCloseLoop: closeLoop,
          numberOfSegments: numberOfSegments,
          turnToFaceNext: turnToFaceNext,
          timestamp: currentTime,
        })
        //TODO must scan path to shift array based on point 1 a curvepath will not pick vector 1 first always
        entity.addComponentOrReplace(new PathData(cpoints,curvePoints,closeLoop,origin))
        if(turnToFaceNext){
          entity.addComponentOrReplace(new RotateData(originQ,lockX,lockY,lockZ,lockW))
        }
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
        
      }
    })
    channel.handleAction<Tween>('tweenControlAction', (action) => {
      const { target, controlMode,tweenControlMove,tweenControlRotate,tweenControlScale, ...tween } = action.values
      log("tweenControlAction called " + target + "  " + controlMode + " (" + tweenControlMove +","+ tweenControlRotate +","+tweenControlScale +")")
      
      const entity = getEntityByName(target)
      if (entity && entity !== undefined) {
        if(tweenControlMove && entity.hasComponent(TweenableMove)){
          this.processControlAction('move',entity,controlMode,TweenableMove)
        }
        if(tweenControlRotate && entity.hasComponent(TweenableRotate)){
          this.processControlAction('rotate',entity,controlMode,TweenableRotate)
        }
        if(tweenControlScale && entity.hasComponent(TweenableScale)){
          this.processControlAction('scale',entity,controlMode,TweenableScale)
        }
      }
    } )
    channel.handleAction<Tween>('moveToPlayer', (action) => {
      const { target,percentOfDistanceToTravel,moveNoCloserThan,lockX,lockY,lockZ, ...tween } = action.values

      
      const entityToMove = getEntityByName(target)
      
      if (entityToMove && action.sender === channel.id) {
        let transformTarget = entityToMove.getComponent(Transform)
        
        let playerPosition = action.values.playerPosition;
        if(!playerPosition){
          playerPosition = new Vector3().copyFrom(player.position)

          this.adjustForSceneRotation(playerPosition,entityToMove);
        }else{
          log("moveToPlayer used existing pos " + playerPosition )
        }
        
        //can we x,y,z to start???
        let endDest:Vector3 = playerPosition

 
        log("moveToPlayer  called " + action.sender + " " + channel.id + " " + action.actionId + " " + action.entityName 
        + " " + target + " " + tween.x + " " + tween.y + " " + tween.z + " | " + endDest.x + " " + endDest.y + " " + endDest.z)

        
        //let endPos:Vector3 = transformEnd.position
          
        endDest = this.computeMoveVector(transformTarget.position,endDest,lockX,lockY,lockZ,percentOfDistanceToTravel,moveNoCloserThan);
        
        let clonedAction = clone(action);

        //set direction to where the item is
        clonedAction.values.relative = false
        clonedAction.values.x = endDest.x;
        clonedAction.values.y = endDest.y;
        clonedAction.values.z = endDest.z;
        
        clonedAction.actionId = "move"

        log("moveToPlayer  cloneCheck " + action.actionId + " " + clonedAction.actionId)

        //channel.createAction("move",action.values)
        
        if(clonedAction.values.onComplete && clonedAction.values.onComplete.length > 0){
          //can we x,y,z to start??? so dont hhvae to have extra value? but then must know action intent
          //rename to senderPosition
          log("clonedAction.onComplete[0] " + clonedAction.values.onComplete[0].actionId )
          clonedAction.values.onComplete[0].values.playerPosition=playerPosition
        }
        
        channel.sendActions(
          [clonedAction]
        )
      }else{
        log("moveToPlayer called " + action.sender + " was not me " + channel.id + " so skipping" )
      }
    })

    channel.handleAction<Tween>('moveToItem', (action) => {
      log("moveToItem called " + action.sender + " " + action.actionId + " " + action.entityName + " " + action.values.target + " -> " + action.values.targetOfInterest)
      const { target, targetOfInterest,percentOfDistanceToTravel,moveNoCloserThan,lockX,lockY,lockZ, ...tween } = action.values

      const entityToMove = getEntityByName(target)
      const entityDest = getEntityByName(targetOfInterest)
      if (entityDest && entityToMove) {
        let transformTarget = entityToMove.getComponent(Transform)
        let transformEnd = entityDest.getComponent(Transform)

        let endPos:Vector3 = transformEnd.position
        let endDest:Vector3 = transformEnd.position

        endDest = this.computeMoveVector(transformTarget.position,endDest,lockX,lockY,lockZ,percentOfDistanceToTravel,moveNoCloserThan);

        //set direction to where the item is
        action.values.relative = false
        action.values.x = endDest.x;
        action.values.y = endDest.y;
        action.values.z = endDest.z;

        //log("moveToItem called dist: stopPercent:" + percentStopDistToUse + " " + distanceWhole + " vs " + distancePartial + "; "   + transformEnd.position.x + " " + transformEnd.position.y + " " + transformEnd.position.z + " vs" + endDest.x + " " + endDest.y + " " + endDest.z)
        
        action.actionId = "move"

        //channel.createAction("move",action.values)
        
        channel.sendActions(
          [action]
        )
      }
    })

    channel.handleAction<Tween>('faceItem', (action) => {
      log("faceItem called")
      const { target, targetOfInterest,lockMode,lockX,lockY,lockZ,lockW, ...tween } = action.values

      const entity = getEntityByName(target)
      const entityLookAt = getEntityByName(targetOfInterest)
      if (entity && entity !== undefined) {
        let transform = entity.getComponent(Transform)
        let lookAtTransform = entityLookAt.getComponent(Transform)
        // Rotate to face the player
        let lookAtTarget = new Vector3(lookAtTransform.position.x, lookAtTransform.position.y, lookAtTransform.position.z)
        
        let endRotation:Quaternion = this.computeFaceAngle(lookAtTarget,transform,lockMode,lockX,lockY,lockZ);
        //const endRotationEuler:Vector3 = endRotation.clone().eulerAngles;//.clone().eulerAngles

        //Quaternion.Euler
        //set direction to where the item is
        action.values.x = endRotation.x;
        action.values.y = endRotation.y;
        action.values.z = endRotation.z;
        action.values.w = endRotation.w; //use euler anges if change action id to rotate
        //clonedAction.values.destPosition = lookAtTarget;
        
        //action.values.destPosition = lookAtTarget;

        action.actionId = "rotate-q" //is rotate-q needed if we can trust eulerAngles conversion?

        channel.sendActions([action])
      }
    })
    

    channel.handleAction<Tween>('facePlayer', (action) => {
      const { target,lockMode,lockX,lockY,lockZ,lockW, ...tween } = action.values
      log("facePlayer called " + target + " " + action.sender + " vs " + channel.id)
      if (action.sender === channel.id) {
        const entity = getEntityByName(target)

        
        //log("entPar " +engine.rootEntity.g)

        if (entity && entity !== undefined) {
          //set direction to where the player is
          let transform = entity.getComponent(Transform)
          // Rotate to face the player
          let playerPosition:Vector3 = action.values.playerPosition;
          if(!playerPosition){
            playerPosition = new Vector3().copyFrom(player.position)
          }else{
            playerPosition = new Vector3().copyFrom(playerPosition)
            log("facePlayer used existing pos " + playerPosition + " " + playerPosition.x )
          }
          
          this.adjustForSceneRotation(playerPosition,entity);

          log("facePlayer player:" + player.position.x + " " + player.position.y + " " + player.position.z 
            +" obj:" + transform.position.x + " " + transform.position.y + " " + transform.position.z )
          
          let lookAtTarget = playerPosition;
          
            let clonedAction = clone(action);
          
            
          let endRotation:Quaternion = this.computeFaceAngle(lookAtTarget,transform,lockMode,lockX,lockY,lockZ);
          const endRotationEuler:Vector3 = endRotation.clone().eulerAngles;//.clone().eulerAngles
          
          
          if(true){
            //set direction to where the item is
            clonedAction.values.x = endRotation.x;
            clonedAction.values.y = endRotation.y;
            clonedAction.values.z = endRotation.z;
            clonedAction.values.w = endRotation.w; //use euler anges if change action id to rotate
            //clonedAction.values.destPosition = lookAtTarget;

              //hope conversion is safe within same sdk
            clonedAction.actionId = "rotate-q" //if we get rid of rotate-q we must make sure rotate can handle playerPosition
          }else{
            //did not work when tried but should work?!?! that is how ootb rotate did it?
            //mabye cuz we are asking rotate fix. where ootb rotate just keeps rotating
            //set direction to where the item is
            clonedAction.values.x = endRotationEuler.x;
            clonedAction.values.y = endRotationEuler.y;
            clonedAction.values.z = endRotationEuler.z;
            
            clonedAction.actionId = "rotate"
          }

          if(clonedAction.values.onComplete && clonedAction.values.onComplete.length > 0){
            log("clonedAction.onComplete[0] " + clonedAction.values.onComplete[0].actionId )
            clonedAction.values.onComplete[0].values.playerPosition=playerPosition
          }
          

          channel.sendActions([clonedAction])
        }
      }else{
        log("facePlayer called for " + target + " " + action.sender + " was not me " + channel.id + " so skipping" )
      }
    })

    // handle actions
    channel.handleAction<Tween>('move', (action) => {
      const { target, ...tween } = action.values
      log("OOTB move called " + action.sender + " " + action.actionId + " " + action.entityName + " " + target + " " + tween.x + " " + tween.y + " " + tween.z );//+ "  " + action.values.marker)
      const sender = action.sender
      const entity = getEntityByName(target)

      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        if (entity.hasComponent(TweenableMove)) {
          let existingTweenble = entity.getComponent(TweenableMove)
          if (
            existingTweenble.sender !== action.sender &&
            existingTweenble.type == 'move' &&
            currentTime - existingTweenble.timestamp < 500 &&
            existingTweenble.x === action.values.x &&
            existingTweenble.y === action.values.y &&
            existingTweenble.z === action.values.z
          ) {
            log("OOTB move same tween already in progress? " + action.sender + " " + action.actionId + " " + action.entityName + " " + target + " " + tween.x + " " + tween.y + " " + tween.z)
            return
          }
        }

        const origin = entity.getComponent(Transform).position.clone()
        const originQ:Quaternion=entity.getComponent(Transform).rotation.clone();
        const tweenable = new TweenableMove({
        //const tweenable = new Tweenable({
          ...tween,
          type: 'move',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }
    })

    channel.handleAction<Tween>('rotate-q', (action) => {
      
      const { target, ...tween } = action.values

      log("rotate-q called " + action.sender + " " + action.actionId + " " + action.entityName + " " + target + " " + tween.x + " " + tween.y + " " + tween.z + " " + tween.speed + " " + tween.curve)

      const sender = action.sender
      const entity = getEntityByName(target)

      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        if (entity.hasComponent(Tweenable)) {
          let existingTweenble = entity.getComponent(TweenableRotate)
          if (
            existingTweenble.sender !== action.sender &&
            existingTweenble.type == 'rotate-q' && //must handle this check better
            currentTime - existingTweenble.timestamp < 500 &&
            existingTweenble.x === action.values.x &&
            existingTweenble.y === action.values.y &&
            existingTweenble.z === action.values.z &&
            existingTweenble.w === action.values.w
          ) {
            // same tween already in progress?
            log("rotate-q same tween already in progress? " + action.sender + " " + action.actionId + " " + action.entityName + " " + target + " " + tween.x + " " + tween.y + " " + tween.z + " " + tween.speed + " " + tween.curve)
            return
          }
        }
        const origin = entity.getComponent(Transform).rotation.clone()
          .eulerAngles
        const originQ = entity.getComponent(Transform).rotation.clone()
        const tweenable = new TweenableRotate({
          ...tween,
          type: 'rotate-q',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }
    })

    channel.handleAction<Tween>('rotate', (action) => {
      
      const { target, ...tween } = action.values

      log("OOTB rotate called " + tween.x + " " + tween.y + " " + tween.z + " " + tween.speed + " " + tween.curve)

      const sender = action.sender
      const entity = getEntityByName(target)

      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        if (entity.hasComponent(Tweenable)) {
          let existingTweenble = entity.getComponent(TweenableRotate)
          if (
            existingTweenble.sender !== action.sender &&
            existingTweenble.type == 'rotate' &&
            currentTime - existingTweenble.timestamp < 500 &&
            existingTweenble.x === action.values.x &&
            existingTweenble.y === action.values.y &&
            existingTweenble.z === action.values.z
          ) {
            // same tween already in progress?
            log("OOTB rotate same tween already in progress? " + action.sender + " " + action.actionId + " " + action.entityName + " " + target + " " + tween.x + " " + tween.y + " " + tween.z)
            return
          }
        }
        const origin = entity.getComponent(Transform).rotation.clone().eulerAngles
        const originQ = entity.getComponent(Transform).rotation.clone()
        //const tweenable = new Tweenable({
        const tweenable = new TweenableRotate({
          ...tween,
          type: 'rotate',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }
    })

    channel.handleAction<Tween>('scale', (action) => {
      const { target, ...tween } = action.values
      const sender = action.sender
      const entity = getEntityByName(target)
      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        if (entity.hasComponent(Tweenable)) {
          let existingTweenble = entity.getComponent(TweenableScale)
          if (
            existingTweenble.sender !== action.sender &&
            existingTweenble.type == 'scale' &&
            currentTime - existingTweenble.timestamp < 500 &&
            existingTweenble.x === action.values.x &&
            existingTweenble.y === action.values.y &&
            existingTweenble.z === action.values.z
          ) {
            // same tween already in progress?
            return
          }
        }
        const origin = entity.getComponent(Transform).scale.clone()
        const originQ:Quaternion=null;
        //const tweenable = new Tweenable({
        const tweenable = new TweenableScale({
          ...tween,
          type: 'scale',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }
    })

    channel.handleAction<AnimationValues>('animate', (action) => {
      const { target, animation, animAction, speed, loop } = action.values
      const sender = action.sender
      const entity = getEntityByName(target)
      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        let animator: Animator

        if (entity.hasComponent(Animator)) {
          animator = entity.getComponent(Animator)
        } else {
          animator = new Animator()
          entity.addComponent(animator)
        }

        let currentAnim: string
        switch (animAction) {
          case 'play':
            if (entity.hasComponent(Animated)) {
              let existingAnim = entity.getComponent(Animated)

              if (
                existingAnim.sender !== action.sender &&
                existingAnim.type == 'play' &&
                currentTime - existingAnim.timestamp < 500 &&
                existingAnim.name === action.values.animation &&
                existingAnim.speed === existingAnim.speed
              ) {
                // same anim already in progress?
                break
              }
              if (existingAnim.type == 'play') {
                // stop any other playing animations

                animator.getClip(existingAnim.name).stop()
              }
            }

            let animClip = animator.getClip(animation)
            animClip.looping = loop
            animClip.speed = speed
            animClip.playing = true
            const animated = new Animated({
              type: 'play',
              name: animation,
              speed: speed,
              loop: loop,
              channel,
              sender,
              timestamp: currentTime,
            })

            entity.addComponentOrReplace(animated)
            entity.addComponentOrReplace(new Syncable())
            break
          case 'stop':
            if (!entity.hasComponent(Animated)) {
              break
            }
            currentAnim = entity.getComponent(Animated).name

            animator.getClip(currentAnim).stop()
            entity.getComponent(Animated).type = 'stop'
            break
          case 'pause':
            if (!entity.hasComponent(Animated)) {
              break
            }
            currentAnim = entity.getComponent(Animated).name

            animator.getClip(currentAnim).pause()
            entity.getComponent(Animated).type = 'pause'
            break
          case 'reset':
            if (!entity.hasComponent(Animated)) {
              break
            }
            currentAnim = entity.getComponent(Animated).name

            animator.getClip(currentAnim).reset()
            entity.getComponent(Animated).type = 'reset'
            break
        }
      }
    })

    channel.handleAction<DelayValues>('delay', (action) => {
      const { timeout, onTimeout } = action.values
      if (action.sender === channel.id) {
        setTimeout(() => {
          channel.sendActions(onTimeout)
        }, timeout * 1000)
      }
    })

    channel.handleAction<DelayValues>('interval', (action) => {
      const { timeout, onTimeout } = action.values
      if (action.sender === channel.id) {
        const intervalAction = channel.createAction<DelayValues>(
          action.actionId,
          action.values
        )
        channel.sendActions(onTimeout)
        setTimeout(() => channel.sendActions([intervalAction]), timeout * 1000)
      }
    })

    channel.handleAction<PrintValues>('print', (action) => {
      const { message, duration, multiplayer } = action.values

      if (!multiplayer && action.sender !== channel.id) {
        // if not multiplayer and not ours prevent showing the message
        return
      }

      const text = new UIText(this.getContainer())
      text.value = message
      text.fontSize = 24
      text.height = 30
      text.width = '100%'
      text.hAlign = 'center'
      text.hTextAlign = 'center'

      setTimeout(() => {
        text.visible = false
        text.height = 0
      }, duration * 1000)
    })

    // sync initial values
    channel.request<SyncEntity[]>('syncEntities', (syncEntities) => {
      for (const syncEntity of syncEntities) {
        const { entityName, transform, tweenMove, tweenRotate, tweenScale, anim } = syncEntity
        const entity = getEntityByName(entityName)
        if (entity && entity !== undefined) {
          const original = entity.getComponent(Transform)
          syncv(original.position, transform.position)
          syncq(original.rotation, transform.rotation)
          syncv(original.scale, transform.scale)
          let tweenArray:SyncEntityTween[] = new Array();
          if( tweenMove && tweenMove !== undefined ) tweenArray.push(tweenMove)
          if( tweenRotate && tweenRotate !== undefined ) tweenArray.push(tweenRotate)
          if( tweenScale && tweenScale !== undefined ) tweenArray.push(tweenScale)
          for( const p in tweenArray){
            const tween = tweenArray[p]
            if (tween) {
              log("got sync for " + entityName + " " + tween.type)
              //CREATE RIGHT TYPE
              let tweenable = null;
              switch(tween.type){
                case 'move': 
                  tweenable = new TweenableMove({
                    ...tween,
                    channel,
                  })
                  break;
                case 'follow-path': {
                  tweenable = new TweenableMove({
                    ...tween,
                    channel,
                  })
                  entity.addComponentOrReplace(tweenable)
                  //TODO pass current origin/target position?
                  let pathData:PathData = new PathData(tween.curvePoints,tween.curveNBPoints,tween.curveCloseLoop,tween.origin)
                  pathData.setPathPosition(tween.pathOriginIndex);
                  entity.addComponentOrReplace(pathData)
                  if(tween.turnToFaceNext){
                    entity.addComponentOrReplace(new RotateData(tween.originQ,tween.lockX,tween.lockY,tween.lockZ,tween.lockW))
                  }
                  break;
                }
                case 'scale': {
                  tweenable = new TweenableScale({
                    ...tween,
                    channel,
                  })
                  break;
                }
                case 'rotate-q':
                case 'rotate': {
                  tweenable = new TweenableRotate({
                    ...tween,
                    channel,
                  })
                  break;
                }
              }
              /*
              tweenable = new Tweenable({
                  ...tween,
                  channel,
                })
                */
            //TODO sync PathData + RotationData
              entity.addComponentOrReplace(tweenable) //TODO either need to move the followCurve into tween OR sync PathData + RotateData objects too
            }
          }
          if (anim) {
            const animated = new Animated({
              ...anim,
              channel,
            })
            entity.addComponentOrReplace(animated)
            let animator = new Animator()
            entity.addComponentOrReplace(animator)

            let animClip = animator.getClip(anim.name)
            animClip.looping = anim.loop
            animClip.speed = anim.speed
            switch (anim.type) {
              case 'play':
                animClip.play()
                break
              case 'stop':
                animClip.stop()
                break
              case 'pause':
                animClip.pause()
                break
              case 'reset':
                animClip.reset()
                break
            }
          }
        }
      }
    })
    channel.reply<SyncEntity[]>('syncEntities', () => {
      //add to getting the hidden entities
      const entities = this.getEntities()
      const allTweenClasses:ComponentConstructor<Tweenable>[] = [Tweenable,TweenableMove,TweenableRotate,TweenableScale]
      
      return entities.map((entity) => {
        const transform = entity.getComponent(Transform)
        const syncEntity: SyncEntity = {
          entityName: entity.name,
          transform: {
            position: [
              transform.position.x,
              transform.position.y,
              transform.position.z,
            ],
            rotation: [
              transform.rotation.x,
              transform.rotation.y,
              transform.rotation.z,
              transform.rotation.w,
            ],
            scale: [transform.scale.x, transform.scale.y, transform.scale.z],
          },
        }
        for(var x=0;x<allTweenClasses.length;x++){
          let component = allTweenClasses[x]
          //log("synch check for " + component.constructor.name)
          if (entity.hasComponent(component)) {
            //TODO sync PathData + RotationData
            const { channel: _, ...tween } = entity.getComponent(component)
            log("sync check found for " + tween.type + " for " + entity.name );//+ " " + tween.)
            //must set tween relating to tween type move,scale,rotate
            //syncEntity.tween = tween //sets all tween data
          }
        }
        if (entity.hasComponent(TweenableMove)) {
          const { channel: _, ...tween } = entity.getComponent(TweenableMove)
          log("sync check found for TweenableMove " + " " + tween.type + " "  + entity.name  );//+ " " + tween.)
          //stuff any extra things into the tween before settings it
          if(entity.hasComponent(PathData)){
            const pathData = entity.getComponent(PathData)
            tween.pathOriginIndex = pathData.origin
          }
          syncEntity.tweenMove = tween //sets all tween data
          
        }
        if (entity.hasComponent(TweenableRotate)) {
          const { channel: _, ...tween } = entity.getComponent(TweenableRotate)
          log("sync check found for TweenableRotate" + " " + tween.type + " "  + entity.name  );//+ " " + tween.)
          syncEntity.tweenRotate = tween //sets all tween data
        }
        if (entity.hasComponent(TweenableScale)) {
          const { channel: _, ...tween } = entity.getComponent(TweenableScale)
          log("sync check found for TweenableScale" + " " + tween.type + " "  + entity.name  );//+ " " + tween.)
          syncEntity.tweenScale = tween //sets all tween data
        }
        if (entity.hasComponent(Animated)) {
          const { channel: _, ...anim } = entity.getComponent(Animated)
          syncEntity.anim = anim
        }

        return syncEntity
      })
    })

    //TODO handle onStart
  }
}

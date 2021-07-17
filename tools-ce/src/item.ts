import {
  TweenSystem,TweenSystemMove,TweenSystemRotate,TweenSystemScale,
  Tweenable,TweenableMove,TweenableRotate,TweenableScale,
  RepeatActionType,SceneChangeAddRmType,TrackingActionType,TargetOfInterestType,
  Tween,
  Syncable,
  TweenType,
  CurveType,
  PathData,
  RotateData,
  TweenableVO,
} from './tween'
import { getEntityByName,computeFaceAngle,computeMoveVector } from './utils'
import { Logger,jsonStringifyActions,jsonStringifyActionsFull,jsonStringifyTweenable,LOGGING_CONF, LoggerLevel } from './logging'
import { setTimeout, DelaySystem } from './delay'
import { Animated, AnimType } from './animation'
import { getEntityWorldPosition, getEntityWorldRotation } from './decentralandecsutils/helpers/helperfunctions'
import { movePlayerTo } from '@decentraland/RestrictedActions'

const VERSION = "1.1.2-alpha"
const ITEM_FULL_NAME = "Toolbox-CE v." + VERSION

export type Props = {
  loggingLevel?: LoggerLevel
}

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
    trackingType: TrackingActionType
    targetOfInterest: string
    targetOfInterestType: TargetOfInterestType
    percentOfDistanceToTravel:number //need for 'follow'
    moveNoCloserThan:number //need for 'follow'
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

//taken from https://github.com/decentraland/decentraland-ecs-utils/blob/master/src/helpers/helperfunctions.ts


//leave player out here as static.  If I init it inside the method for some resaon the player position reports 0s first usage????
const player = Camera.instance

export default class Tools implements IScript<Props> {
  removedEntities: Record<string, IEntity> = {}
  canvas = new UICanvas()
  container: UIContainerStack

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
    log(ITEM_FULL_NAME  + " initializing... " )
    //tweenSystem = new TweenSystem()
    //engine.addSystem(this.tweenSystem)
    engine.addSystem(this.tweenSystemMove)
    engine.addSystem(this.tweenSystemRotate)
    engine.addSystem(this.tweenSystemScale)
    engine.addSystem(this.delaySystem)
    log(ITEM_FULL_NAME + " initializing DONE " )
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

  
  spawn(host: Entity, props: Props, channel: IChannel) {
    LOGGING_CONF.level = props.loggingLevel
    log(ITEM_FULL_NAME + " logging level set to " + LOGGING_CONF.level )

    const logger = new Logger("Toolbox",{channelId:channel.id})
    if(logger.isTraceEnabled()) logger.trace( "spawn","ENTRY",[host,props,channel] )
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
      const METHOD_NAME = "channel.handle.sceneAddRemove"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "called " + jsonStringifyActions(action) + " " + target + " action " + sceneAddRemove,null)

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
      }else if(!entity){
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " for action " + sceneAddRemove,null)
      }
      
      channel.sendActions(tween.onComplete)
    } )
    channel.handleAction<Tween>('attachToItem', (action) => {
      const { target, attachToOrigin, ...tween } = action.values
      const METHOD_NAME = "channel.handle.attachToItem"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "called " + jsonStringifyActions(action) + " " + target + " to " + tween.targetOfInterest + " attachOrigin:" + attachToOrigin, null)

      const entityToAttach = getEntityByName(target)
      const entityTarget = getEntityByName(tween.targetOfInterest)
      if (entityToAttach && entityTarget) {
        const transformParent = entityTarget.getComponent(Transform)
        const transformChild = entityToAttach.getComponent(Transform)

        const parentRotation = entityTarget.hasComponent(Transform)
            ? entityTarget.getComponent(Transform).rotation
            : Quaternion.Identity


        let onSceneReadyObservableExists = typeof onSceneReadyObservable !== 'undefined'
        //log("onSceneReadyObservable ")
        //log("onSceneReadyObservable: "+onSceneReadyObservableExists)

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
        }else{
          //does not seem to help 6.3.3  probably cuz setting rotation!?!?!
          log(" ABS utilsDelay fired in glass.ts holdding pre 0 then set for " + target)
              //FIXME not right. it attaches but not rotated from center of item
              let vectorPos = transformChild.position.subtract(transformParent.position)
              //TODO ADD multiply by scale
              vectorPos = vectorPos.clone().rotate(parentRotation.conjugate()).divide(transformParent.scale)

              //vectorPos = 
              transformParent.position.subtract(
              transformChild.position.clone().rotate(parentRotation))
              
                //FIXME must hold its old parent
              tempLastHost = entityTarget.getParent()
              log("last parent " + tempLastHost.name);
              transformChild.position = vectorPos
      
              transformChild.rotation = transformChild.rotation.multiply(parentRotation.conjugate())
              transformChild.scale = transformChild.scale.divide(transformParent.scale)
              entityToAttach.setParent(entityTarget);
        }
        
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entityToAttach + " and/or " + tween.targetOfInterest  + " " + entityTarget,null)
      }

      channel.sendActions(tween.onComplete)
    } )

    channel.handleAction<Tween>('detachFromItem', (action) => {
      const { target,  ...tween } = action.values

      const METHOD_NAME = "channel.handle.detachFromItem"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + " from " + tween.targetOfInterest , null)

      const entityToDetach = getEntityByName(target)
      const entityTarget = getEntityByName(tween.targetOfInterest)
      if (entityToDetach && entityTarget) {
        //must grab old value to put back
        let transformChild = entityToDetach.getComponent(Transform)
        let transformParent = entityTarget.getComponent(Transform)
        //TODO only detatch if is its parent
        log("last parent " + tempLastHost.name);
        
        transformChild.rotation = getEntityWorldRotation(entityToDetach);
          
        log("rotation " + transformChild.eulerAngles);

        //drops position well
        transformChild.position = getEntityWorldPosition(entityToDetach)
        //TODO can we push this into getEntityWorldPosition?
        this.adjustForSceneRotation(transformChild.position,entityToDetach)

        transformChild.scale = transformChild.scale.multiply(transformParent.scale)
        //FIXME must hold its old parent
        entityToDetach.setParent(tempLastHost)
        
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entityToDetach + " and/or " + tween.targetOfInterest  + " " + entityTarget,null)
      }
      channel.sendActions(tween.onComplete)
    } )
    
    channel.handleAction<Tween>('followItemPath', (action) => {
      const { target , ...tween } = action.values

      const METHOD_NAME = "channel.handle.followItemPath"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + "  " + " (" + tween.pathItem1 +","+ tween.pathItem2 +","+tween.pathItem3 +","+tween.pathItem4 +","+tween.pathItem5 +")" , null)

      const sender = action.sender
      const entity = getEntityByName(target)

      if (entity && entity !== undefined) {
        const currentTime: number = +Date.now()
        let transform = entity.getComponent(Transform)

        // how many points on the curve
        let curvePoints = Math.max(1,tween.numberOfSegments)
        let closeLoop = tween.returnToFirst

        // Compile these points into an array
        const cpoints = new Array()

        let pathItems = [tween.pathItem1,tween.pathItem2,tween.pathItem3,tween.pathItem4,tween.pathItem5]

        //hacking using var to create signatureOfVectors
        let cpointsSignatureHack = new Vector3()
        
        //add current position of item
        cpoints.push(new Vector3().copyFrom(transform.position))//why must it be second and not first?!?!?
        cpointsSignatureHack.addInPlace(cpoints[cpoints.length-1])

        //loop over item paths
        for(var x=0;x<pathItems.length;x++){
          let itmName = pathItems[x];

          if(itmName === null || itmName === undefined){
          log("follow path " + x + " invalid item " + itmName );
            continue;
          }
          let pathEnt = getEntityByName(itmName);
          
          if(pathEnt && pathEnt !== undefined){
            log("follow path " + x +" adding " + itmName + " point.len "+cpoints.length);
            cpoints.push(new Vector3().copyFrom(pathEnt.getComponent(Transform).position));
            cpointsSignatureHack.addInPlace(cpoints[cpoints.length-1])
          }else{
            if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + itmName + " for action " + itmName + " for index " + x,null)
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
            if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "action matching parameters already in progress. ignoring this one. existing tween:" + jsonStringifyTweenable(existingTweenble) + " new action " + jsonStringifyActions(action),null)
            return
          }
        }

        let entityTransform = null;
        if(entity.hasComponent(Transform)){
          entityTransform = entity.getComponent(Transform)
        }else{
          if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  target + " does not have Transform?!?!",null)
        }

        const origin = entityTransform.position.clone()
        const originQ:Quaternion=entityTransform.rotation.clone();
        const tweenable = new TweenableMove({
          ...tween,
          type: 'follow-path',
          channel,
          origin,
          originQ,
          sender,
          curvePoints: cpoints,
          curveNBPoints: curvePoints,
          curveCloseLoop: closeLoop,
          numberOfSegments: tween.numberOfSegments,
          turnToFaceNext: tween.turnToFaceNext,
          timestamp: currentTime,
        })
        
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "adding Tweenable Component to " + target + " " + jsonStringifyTweenable(tweenable),null)
        entity.addComponentOrReplace(new PathData(cpoints,curvePoints,closeLoop,origin))
        if(tween.turnToFaceNext){
          entity.addComponentOrReplace(new RotateData(originQ,tween.lockX,tween.lockY,tween.lockZ,tween.lockW))
        }
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
        
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
      }
    })
    channel.handleAction<Tween>('tweenControlAction', (action) => {
      const { target, ...tween } = action.values

      const METHOD_NAME = "channel.handle.tweenControlAction"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + "  " + tween.controlMode + " (" + tween.tweenControlMove +","+ tween.tweenControlRotate +","+tween.tweenControlScale +")" , null)
      
      //TODO check to see if doing already if possible
      const entity = getEntityByName(target)
      if (entity && entity !== undefined) {
        if(tween.tweenControlMove && entity.hasComponent(TweenableMove)){
          this.processControlAction('move',entity,tween.controlMode,TweenableMove)
        }
        if(tween.tweenControlRotate && entity.hasComponent(TweenableRotate)){
          this.processControlAction('rotate',entity,tween.controlMode,TweenableRotate)
        }
        if(tween.tweenControlScale && entity.hasComponent(TweenableScale)){
          this.processControlAction('scale',entity,tween.controlMode,TweenableScale)
        }
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
      }

      channel.sendActions(action.values.onComplete)
    } )
    channel.handleAction<Tween>('moveToPlayer', (action) => {
      const { target, ...tween } = action.values

      const METHOD_NAME = "channel.handle.moveToPlayer"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + action.values.target + " -> player " + action.sender , null)
      
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

        endDest = computeMoveVector(transformTarget.position,endDest,tween.lockX,tween.lockY,tween.lockZ,tween.percentOfDistanceToTravel,tween.moveNoCloserThan);
        
        let clonedAction = clone(action);
        if(!clonedAction.values.targetOfInterest){
          clonedAction.values.targetOfInterest = action.sender
        }else{
          log("moveToPlayer had sender already " + action.sender + " " + clonedAction.values.targetOfInterest + " " + channel.id)
        }
        clonedAction.values.targetOfInterestType = 'player'

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
        
        //send move so everyone else gets it
        channel.sendActions( [clonedAction] )
      }else if(!entityToMove){
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entityToMove,null)
      }else{
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "moveToPlayer called by " + action.sender + ".  Is not me " + channel.id + " so skipping",null)
      }
    })

    channel.handleAction<Tween>('moveToItem', (action) => {
      const { target, ...tween } = action.values 

      const METHOD_NAME = "channel.handle.moveToItem"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + action.values.target + " -> " + action.values.targetOfInterest, null)

      const entityToMove = getEntityByName(target)
      const entityDest = getEntityByName(tween.targetOfInterest)
      //FIXME?? add if (action.sender === channel.id) { since it chains?? or dont chain action calls and do all work here
      if (entityDest && entityToMove) {
        let transformTarget = entityToMove.getComponent(Transform)
        let transformEnd = entityDest.getComponent(Transform)

        let endDest:Vector3 = transformEnd.position

        endDest = computeMoveVector(transformTarget.position,endDest,tween.lockX,tween.lockY,tween.lockZ,tween.percentOfDistanceToTravel,tween.moveNoCloserThan);

        //set direction to where the item is
        action.values.relative = false
        action.values.x = endDest.x;
        action.values.y = endDest.y;
        action.values.z = endDest.z;
 
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "moveToItem called dist: target:" + target + " " + tween.trackingType +  "; stopPercent:" + tween.percentOfDistanceToTravel 
                +  "; moveNoCloserThan:" + ".vs."+tween.moveNoCloserThan + ";"   + transformEnd.position.x + " " + transformEnd.position.y + " " + transformEnd.position.z + " vs " + endDest.x + " " + endDest.y + " " + endDest.z, null)
        
        //FIXME use create action insead of cloning
        action.actionId = "move"

        //channel.createAction("move",action.values)
        
        //TODO establish origin state here incase out of sync?

        channel.sendActions( [action] )
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entityToMove + " and/or " + tween.targetOfInterest  + " " + entityDest,null)
      }
    })

    channel.handleAction<Tween>('faceItem', (action) => {
      const { target, lockMode,lockX,lockY,lockZ,lockW, ...tween } = action.values

      const METHOD_NAME = "channel.handle.faceItem"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + action.values.target + " -> " + action.values.targetOfInterest, null)


      const entity = getEntityByName(target)
      const entityLookAt = getEntityByName(tween.targetOfInterest)
      //FIXME?? add if (action.sender === channel.id) { since it chains?? or dont chain action calls and do all work here
      if (entity && entity !== undefined) {
        let transform = entity.getComponent(Transform)
        let lookAtTransform = entityLookAt.getComponent(Transform)
        // Rotate to face the player
        let lookAtTarget = new Vector3().copyFrom(lookAtTransform.position)
        
        let endRotation:Quaternion = computeFaceAngle(lookAtTarget,transform,lockMode,lockX,lockY,lockZ);

        //Quaternion.Euler
        //set direction to where the item is
        action.values.x = endRotation.x;
        action.values.y = endRotation.y;
        action.values.z = endRotation.z;
        action.values.w = endRotation.w; //use euler anges if change action id to rotate
        //clonedAction.values.destPosition = lookAtTarget;
        
        //action.values.destPosition = lookAtTarget;

        //FIXME use create action insead of cloning
        action.actionId = "rotate-q" //is rotate-q needed if we can trust eulerAngles conversion?

        channel.sendActions([action])
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity + " and/or " + tween.targetOfInterest  + " " + entityLookAt,null)
      }
    })
    

    channel.handleAction<Tween>('facePlayer', (action) => {
      const { target,lockMode,lockX,lockY,lockZ,lockW, ...tween } = action.values

      const METHOD_NAME = "channel.handle.facePlayer"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + "  face player " + action.sender + " vs " + channel.id, null)

      if (action.sender === channel.id) {
        const entity = getEntityByName(target)

        if (entity && entity !== undefined) {
          //FIXME add a already doing this check

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

          let lookAtTarget = playerPosition;
          
          let clonedAction = clone(action);
          
          let endRotation:Quaternion = computeFaceAngle(lookAtTarget,transform,lockMode,lockX,lockY,lockZ);
          const endRotationEuler:Vector3 = endRotation.clone().eulerAngles;//.clone().eulerAngles
          
          
          //set direction to where the item is
          clonedAction.values.x = endRotation.x;
          clonedAction.values.y = endRotation.y;
          clonedAction.values.z = endRotation.z;
          clonedAction.values.w = endRotation.w; //use euler anges if change action id to rotate
          //clonedAction.values.destPosition = lookAtTarget;

          //FIXME use create action
          //hope conversion is safe within same sdk
          clonedAction.actionId = "rotate-q" //if we get rid of rotate-q we must make sure rotate can handle playerPosition
          
          //TODO need better recursive logic here
          if(clonedAction.values.onComplete && clonedAction.values.onComplete.length > 0){
            log("clonedAction.onComplete[0] " + clonedAction.values.onComplete[0].actionId )
            clonedAction.values.onComplete[0].values.playerPosition=playerPosition
          }
          if(!clonedAction.values.targetOfInterest){
            clonedAction.values.targetOfInterest = action.sender
          }else{
            log("facePlayer had sender already " + action.sender + " " + clonedAction.values.targetOfInterest + " " + channel.id)
          }
          clonedAction.values.targetOfInterestType = 'player'
          
          //send rotate move so everyone else gets it
          channel.sendActions([clonedAction])
        }else{
          if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
        }
      }else{
        log("facePlayer called for " + target + " from " + action.sender + ". was not me " + channel.id + " so skipping" )
      }
    })

    // handle actions
    channel.handleAction<Tween>('move', (action) => {
      const { target, ...tween } = action.values

      const METHOD_NAME = "channel.handle.move"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + jsonStringifyActions(action) + " " + target + " " + tween.x + " " + tween.y + " " + tween.z, null)


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
            if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "action matching parameters already in progress. ignoring this one. existing tween:" + jsonStringifyTweenable(existingTweenble) + " new action " + jsonStringifyActions(action),null)
            return
          }
        }

        const origin = entity.getComponent(Transform).position.clone()
        const originQ:Quaternion=entity.getComponent(Transform).rotation.clone();
        
        const tweenable = new TweenableMove({
          ...tween,
          type: 'move',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "adding Tweenable Component to " + target + " " + jsonStringifyTweenable(tweenable),null)
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
      }
    })

    channel.handleAction<Tween>('rotate-q', (action) => {
      const { target, ...tween } = action.values

      const METHOD_NAME = "channel.handle.rotate-q"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + tween.x + " " + tween.y + " " + tween.z + " " + tween.speed + " " + tween.curve, null)

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
            if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "action matching parameters already in progress. ignoring this one. existing tween:" + jsonStringifyTweenable(existingTweenble) + " new action " + jsonStringifyActions(action),null)
            return
          }
        }
        const rotOrigin = entity.getComponent(Transform).rotation.clone();
        const origin = rotOrigin.eulerAngles
        const originQ = rotOrigin

        const tweenable = new TweenableRotate({
          ...tween,
          type: 'rotate-q',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "adding Tweenable Component to " + target + " " + jsonStringifyTweenable(tweenable),null)
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
      }
    })

    channel.handleAction<Tween>('rotate', (action) => {
      const { target, ...tween } = action.values

      const METHOD_NAME = "channel.handle.rotate"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + tween.x + " " + tween.y + " " + tween.z + " " + tween.speed + " " + tween.curve, null)

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
            if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "action matching parameters already in progress. ignoring this one. existing tween:" + jsonStringifyTweenable(existingTweenble) + " new action " + jsonStringifyActions(action),null)
            return
          }
        }
        const rotOrigin = entity.getComponent(Transform).rotation.clone();
        const origin = rotOrigin.eulerAngles
        const originQ = rotOrigin

        const tweenable = new TweenableRotate({
          ...tween,
          type: 'rotate',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "adding Tweenable Component to " + target + " " + jsonStringifyTweenable(tweenable),null)
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
      }
    })

    channel.handleAction<Tween>('scale', (action) => {
      const { target, ...tween } = action.values

      const METHOD_NAME = "channel.handle.scale"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target + tween.x + " " + tween.y + " " + tween.z + " " + tween.speed + " " + tween.curve, null)

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
            if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "action matching parameters already in progress. ignoring this one. existing tween:" + jsonStringifyTweenable(existingTweenble) + " new action " + jsonStringifyActions(action),null)
            return
          }
        }
        const origin = entity.getComponent(Transform).scale.clone()
        const originQ:Quaternion=null;
        
        const tweenable = new TweenableScale({
          ...tween,
          type: 'scale',
          channel,
          origin,
          originQ,
          sender,
          timestamp: currentTime,
        })
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  "adding Tweenable Component to " + target + " " + jsonStringifyTweenable(tweenable),null)
        entity.addComponentOrReplace(tweenable)
        entity.addComponentOrReplace(new Syncable())
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
      }
    })

    channel.handleAction<AnimationValues>('animate', (action) => {
      const { target, animation, animAction, speed, loop } = action.values

      const METHOD_NAME = "channel.handle.animate"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",[jsonStringifyActionsFull(action)] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called " + jsonStringifyActions(action) + " " + target, null)

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
      }else{
        if(logger.isWarnEnabled()) logger.warn( METHOD_NAME,  "could not find " + " " + target + " " + entity,null)
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
      const METHOD_NAME = "channel.request.syncEntities"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY", [syncEntities] )
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called. recieved " + (syncEntities ? syncEntities.length : null), null)

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
          let addSyncable = false;
          for( const p in tweenArray){
            const tween = tweenArray[p]
            if (tween) {
              //log(METHOD_NAME + DEBUG_MSG_ID + "; got sync for " + entityName + " " + tween.type)
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
              addSyncable = true;
            }
          }
          //does animation need syncable?
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
          if(addSyncable){
            entity.addComponentOrReplace(new Syncable()) //make new player to be able to respond
          }
        }
      }
    })
    channel.reply<SyncEntity[]>('syncEntities', () => {
      const METHOD_NAME = "channel.reply.syncEntities"
      if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY",null )
      //TODO add to getting the removed entities
      const entities = this.getEntities()
      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called. entities count " + (entities ? entities.length : null), null)

      //const allTweenClasses:ComponentConstructor<Tweenable>[] = [Tweenable,TweenableMove,TweenableRotate,TweenableScale]
      
      //TODO if entities is null or size 0 AND never called request throw error
      //also re-register request action as probably removed. tricky as needs to do it after this method leaves
      //sync and request keys are same. make diff keys to avoid removing the other?

      const returnSyncEntity = entities.map((entity) => {
        const METHOD_NAME = "channel.request.syncEntities.lambda"
        if(logger.isTraceEnabled()) logger.trace( METHOD_NAME,"ENTRY", null )
        if(logger.isDebugEnabled()) logger.debug( METHOD_NAME, "called ", null)
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
        /*
        //TODO use this if can back in the member var to be assigned
        for(var x=0;x<allTweenClasses.length;x++){
          let component = allTweenClasses[x]
          //log("synch check for " + component.constructor.name)
          if (entity.hasComponent(component)) {
            //TODO sync PathData + RotationData
            const { channel: _, ...tween } = entity.getComponent(component)
            //log("sync check found for " + tween.type + " for " + entity.name );//+ " " + tween.)
            //must set tween relating to tween type move,scale,rotate
            //syncEntity.tween = tween //sets all tween data
          }
        }*/
        if (entity.hasComponent(TweenableMove)) {
          const { channel: _, ...tween } = entity.getComponent(TweenableMove)
          //log("sync check found for TweenableMove " + " " + tween.type + " "  + entity.name  );//+ " " + tween.)
          //stuff any extra things into the tween before settings it
          if(entity.hasComponent(PathData)){
            const pathData = entity.getComponent(PathData)
            tween.pathOriginIndex = pathData.origin
          }
          //TODO need rotate data!
          syncEntity.tweenMove = tween //sets move tween data
          
        }
        if (entity.hasComponent(TweenableRotate)) {
          const { channel: _, ...tween } = entity.getComponent(TweenableRotate)
          //log("sync check found for TweenableRotate" + " " + tween.type + " "  + entity.name  );//+ " " + tween.)
          syncEntity.tweenRotate = tween //sets rotate tween data
        }
        if (entity.hasComponent(TweenableScale)) {
          const { channel: _, ...tween } = entity.getComponent(TweenableScale)
          //log("sync check found for TweenableScale" + " " + tween.type + " "  + entity.name  );//+ " " + tween.)
          syncEntity.tweenScale = tween //sets scale tween data
        }
        if (entity.hasComponent(Animated)) {
          const { channel: _, ...anim } = entity.getComponent(Animated)
          syncEntity.anim = anim
        }
        return syncEntity
      })

      if(logger.isDebugEnabled()) logger.debug( METHOD_NAME,  " returning " + (returnSyncEntity ? returnSyncEntity.length : null),null)

      return returnSyncEntity
    })

    //TODO handle onStart
  }
}

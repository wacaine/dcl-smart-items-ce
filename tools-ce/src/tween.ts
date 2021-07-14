import { getEntityByName,computeFaceAngle,computeMoveVector } from './utils'
import { Logger,jsonStringifyActions,jsonStringifyActionsFull } from './logging'

export type TweenType = 'move' | 'rotate' | 'rotate-q' | 'scale' | 'follow-path'
export type SceneChangeAddRmType = 'add' | 'remove'
export type RepeatActionType = 'none' | 'absolute' | 'relative' | 'reverse'
export type TrackingActionType = 'none' | 'current' | 'meet' | 'follow'
export type TargetOfInterestType = 'entity' | 'player'

export type Tween = {
 // transition: number
  target: string,
  targetOfInterestType: TargetOfInterestType
  targetOfInterest: string //transient conveted to x,y,z ; now needed for active tracking
  pathItem1: string //transient conveted to curvePoints
  pathItem2: string //transient conveted to curvePoints
  pathItem3: string //transient conveted to curvePoints
  pathItem4: string //transient conveted to curvePoints
  pathItem5: string //transient conveted to curvePoints
  percentOfDistanceToTravel: number, //conveted to x,y,z - need for 'follow'
  moveNoCloserThan: number //conveted to x,y,z - need for 'follow'
  playerPosition:Vector3 //????transient conveted to x,y,z?????
  sceneAddRemove: SceneChangeAddRmType //add to pass for syncable
  attachToOrigin: boolean//transient???
  lockMode:string
  lockX:boolean
  lockY:boolean
  lockZ:boolean
  lockW:boolean //can we get rid of this since we convert between euler and back?
  x: number
  y: number
  z: number
  w: number
  //destPosition: Vector3 //get rid of this param!!!
  curve: CurveType
  curvePoints: Vector3[]
  curveNBPoints: number  
  curveCloseLoop: boolean
  returnToFirst: boolean//follow path? transient?
  numberOfSegments: number//for PathData and RotationData
  turnToFaceNext: boolean//REMOVE ME?!? not needed if lock all axis? gate to enable locking??? for PathData and RotationData
  trackingType: TrackingActionType
  controlMode: string
  tweenControlMove: boolean
  tweenControlRotate: boolean
  tweenControlScale: boolean
  repeatAction: RepeatActionType
  speed: number
  relative: boolean
  onComplete: Actions
}

// Custom component to store current speed
@Component("pathSpeed")
export class PathSpeed {
  speed: number = 0.5
}

@Component("pathData")
export class PathData {
  start: number = 0
  origin: number = 0
  originVector: Vector3;//because sometimes origin is not 0???
  target: number = 1
  points: Vector3[]
  curvePoints: number = 25
  closeLoop: boolean = true
  path: Vector3[] = null
  fraction: number = 0
  constructor(points: Vector3[], curvePoints: number, closeLoop:boolean,originVector: Vector3){
    this.points = points
    this.curvePoints = curvePoints;
    this.closeLoop = closeLoop
    this.originVector = originVector
    // Create a Catmull-Rom Spline curve. This curve passes through all 4 points. The total number of points in the path is set by  `curvePoints`
    this.path = Curve3.CreateCatmullRomSpline(this.points, this.curvePoints, this.closeLoop).getPoints()

    //for some reason does not always give me curve where pt1 == path[0]
    //so must find it and resort path so it is first
    let trueOrgIdx = -1
    for(let x=0;x<this.path.length;x++){
      let sqDistOrigins = Vector3.Distance(this.originVector, this.path[x]);
      let vectEq = sqDistOrigins < .0001
      //log("x " + vectEq + " " + this.originVector + " " + this.path[x])
      if(vectEq && trueOrgIdx < 0){
        trueOrgIdx = x;
      }
    }
    log("trueOrgIdx " + trueOrgIdx + " " + this.originVector + " " + this.path[trueOrgIdx])
    if(trueOrgIdx > 0){
      //adjust start and end points
      //this.path = tmpPath;
      this.origin = trueOrgIdx;
      this.target = this.origin+1;
      this.start = this.origin;
    }
  }
  setPathPosition(originIdx:number){
    log("setPathPosition " + originIdx)
    this.origin = originIdx;
    this.target = this.origin+1;
  }
}

// Custom component to store rotational lerp data
@Component("rotateData")
export class RotateData {
  startingRot: Quaternion
  originRot: Quaternion
  targetRot: Quaternion
  fraction: number = 0
  lockX:boolean
  lockY:boolean
  lockZ:boolean
  lockW:boolean
  constructor(startingRot:Quaternion,lockX: boolean,lockY: boolean,lockZ: boolean,lockW: boolean){
    this.startingRot = startingRot
    this.lockX = lockX;
    this.lockY = lockY;
    this.lockZ = lockZ;
    this.lockW = lockW;
  }
}

@Component('org.decentraland.Syncable')
export class Syncable {}

//@Component('org.decentraland.Tweenable')
export class TweenableVO {
  transition: number = 0
  type: TweenType
  curve: CurveType = CurveType.LINEAR
  x: number
  y: number
  z: number
  w: number
  //destPosition: Vector3// get rid of?
  //playerPosition:Vector3, tansient captured as x,y,z - no need to save add so syncEntity matchess up?
  speed: number
  relative: boolean
  onComplete: Actions
  channel: IChannel
  origin: Vector3
  originQ: Quaternion //rename originRotation
  //curvePath: Curve3 //save so synEntities works?!?! really need to save antirre path + rotation data
  curvePoints: Vector3[]
  curveNBPoints: number  
  curveCloseLoop : boolean
  numberOfSegments: number
  turnToFaceNext: boolean
  trackingType: TrackingActionType
  targetOfInterest: string
  targetOfInterestType: TargetOfInterestType
  percentOfDistanceToTravel: number //need for 'follow'
  moveNoCloserThan: number //need for 'follow'
  repeatAction: RepeatActionType
  sceneAddRemove: SceneChangeAddRmType //add to pass for syncable????
  sender: string = 'initial'
  timestamp: number
  enabled: boolean
  //TODO figure out how to remove these lock param
  lockX:boolean//for PathData and RotationData
  lockY:boolean//for PathData and RotationData
  lockZ:boolean//for PathData and RotationData
  lockW:boolean//for PathData and RotationData
  pathOriginIndex: number//need to persit - for PathData and RotationData

  constructor(args: {
    transition?: number
    type: TweenType
    x: number
    y: number
    z: number
    w: number
    //destPosition?: Vector3
    speed: number
    relative: boolean
    onComplete: Actions
    channel: IChannel
    origin: Vector3
    originQ: Quaternion //rename originRotation
    curve?: CurveType
    //curvePath?: Curve3
    curvePoints?: Vector3[]
    curveNBPoints?: number  
    curveCloseLoop?: boolean
    numberOfSegments?: number  
    turnToFaceNext?: boolean
    trackingType?: TrackingActionType
    targetOfInterest?: string
    targetOfInterestType?: TargetOfInterestType
    percentOfDistanceToTravel?:number
    moveNoCloserThan?:number
    repeatAction?: RepeatActionType
    lockX?:boolean
    lockY?:boolean
    lockZ?:boolean
    sender?: string
    timestamp?: number
    enabled?: boolean
    sceneAddRemove?: SceneChangeAddRmType //is this needed!?!!?
  }) {
    if(args.transition && args.transition !== undefined) this.transition = args.transition
    this.type = args.type
    this.x = args.x
    this.y = args.y
    this.z = args.z
    this.w = args.w
    this.percentOfDistanceToTravel = args.percentOfDistanceToTravel
    this.moveNoCloserThan = args.moveNoCloserThan
    //this.destPosition = args.destPosition
    this.speed = args.speed
    this.relative = args.relative
    this.onComplete = args.onComplete
    this.channel = args.channel
    this.origin = args.origin
    this.originQ = args.originQ
    this.curve = args.curve
    //putting curve stuff here just cuz its easier than 
    //having to manage multiple object
    //can be my god object
    this.curvePoints = args.curvePoints
    this.curveNBPoints = args.curveNBPoints
    this.curveCloseLoop = args.curveCloseLoop
    this.numberOfSegments = args.numberOfSegments
    this.turnToFaceNext = args.turnToFaceNext
    this.trackingType = args.trackingType
    this.targetOfInterest = args.targetOfInterest
    this.targetOfInterestType = args.targetOfInterestType
    this.repeatAction = args.repeatAction
    this.lockX = args.lockX
    this.lockY = args.lockY
    this.lockZ = args.lockZ
    this.sender = args.sender
    this.timestamp = args.timestamp
    this.enabled = (args.enabled && args.enabled == true)
    this.sceneAddRemove = args.sceneAddRemove

  }
}

@Component('org.decentraland.Tweenable')
export class Tweenable extends TweenableVO{
}

@Component('org.decentraland.TweenableMove')
export class TweenableMove extends TweenableVO{

}
@Component('org.decentraland.TweenableRotate')
export class TweenableRotate extends TweenableVO{

}
@Component('org.decentraland.TweenableScale')
export class TweenableScale extends TweenableVO{

}
const offsetFactory = (tweenable: Tweenable, relative: Vector3) => (
  axis: 'x' | 'y' | 'z'
) => {
  const value = tweenable[axis]
  const offset = relative[axis]

  return tweenable.relative ? value + offset : value
}

//leave player out here as static.  If I init it inside the method for some resaon the player position reports 0s first usage????
const player = Camera.instance

const logger = new Logger("tween.js",{})

export class TweenSystem<T> {
  syncableGroup = engine.getComponentGroup(Syncable)
  component:ComponentConstructor<T> = null
  //let xxx:typeof Tweenable = Tweenable
  //TODO pass to constructor the group type TweenableRotate vs TweenableMove vs TweenableScale
  tweenableGroup = null;//engine.getComponentGroup(Tweenable)
  logger = new Logger("tween.js",{})

  constructor(component:ComponentConstructor<T>){
    this.logger = new Logger(this.getClassName(),{})
    if(this.logger.isTraceEnabled()) this.logger.trace( "constructor","ENTRY",[component] )

    this.setComponent(component)
    this.setTweenableGroup(engine.getComponentGroup(this.component))
  }
  setTweenableGroup(group:ComponentGroup){
    this.tweenableGroup = group
  }
  getComponent():ComponentConstructor<T>{
    log(this.getClassName()+".getComponent() called")
    return this.component
  }
  setComponent(component:ComponentConstructor<T>){
    log(this.getClassName()+".setComponent() called")
    this.component = component
  }
  getClassName():string{ //if minified not sure can trust this?!?!
    return "TweenSystem";//this.constructor.name
  }
  removeComponent(entity:IEntity){
    if(this.logger.isTraceEnabled()) this.logger.trace( "removeComponent","called", null )
    entity.removeComponent(this.component)
  }
  update(dt: number) {
    const METHOD_NAME = "update"
    if(this.tweenableGroup.entities.length > 0){
      //log(this.getClassName() + " " + this.tweenableGroup.entities.length) 
    }
    for (const entity of this.tweenableGroup.entities) {
      
      const tweenable = entity.getComponent(this.component)
      const transform:Transform = entity.getComponent(Transform)

      let trackingEntity = null
      let trackingTransform:Transform = null;
      let trackingTweenable = null;
      
    
      if(tweenable.enabled == false){
        //log(entity.name + " disabled")
        continue;
      }

      if(tweenable.trackingType && tweenable.targetOfInterest){
        //TODO cache this so not looked up each time? into a component??
        //make a record lookup cache? cleaned out when done?
        trackingEntity = getEntityByName(tweenable.targetOfInterest);

        if(trackingEntity){
          trackingTransform = trackingEntity.getComponent(Transform)
          if(trackingEntity.hasComponent(this.component)){
            trackingTweenable = trackingEntity.getComponent(this.component)
          }
        }else{
          //log not found but expected!?!?!
        }
      }
      
      //currentPosition,meet,follow
      //addd if trackingType:'meet' and trackingName is not null and entity[trackingName].hasComponent(this.component)
      //repeat:None|current: move point
      //repeat:None|meet: move point future point - poll incase updates
      //repeat:None|follow: move to current position
      
      //repeat:abs|current: move point
      //repeat:abs|meet: move point future point - poll incase updates
      //repeat:abs|follow: move to current position

      //repeat:rel|current: move point
      //repeat:rel|meet: move point future point - poll incase updates
      //repeat:rel|follow: move to current position

      //repeat:mirror|current: move point
      //repeat:mirror|meet: move point future point - poll incase updates
      //repeat:mirror|follow: move to current position
        //copy that as its target point? cache it as the target?

        //move uses  x,y,z
        //rotate uses x,y,z
        //scale uses 

      const speed = tweenable.speed / 10
      
      switch (tweenable.type) {
        case 'move': {
          const start = tweenable.origin
          //TODO switch to using computeMoveVector however must convert x,y,z to vector objects
          if(tweenable.trackingType && tweenable.trackingType != 'current'){
            if(trackingTweenable && tweenable.trackingType == 'meet' ){ //TODO move 'meet' to invoker???
              const end = new Vector3(trackingTweenable.x, trackingTweenable.y, trackingTweenable.z)
              const endDest = computeMoveVector(start,end,tweenable.lockX,tweenable.lockY,tweenable.lockZ,tweenable.percentOfDistanceToTravel,tweenable.moveNoCloserThan);
              
              tweenable.x = endDest.x
              tweenable.y = endDest.y
              tweenable.z = endDest.z
            }else if(tweenable.trackingType == 'follow'){
              let end = null;
                
              if(trackingTransform){
                end = new Vector3().copyFrom(trackingTransform.position)//is copy required? flyweight for vector storage?
              }else if(tweenable.targetOfInterestType == 'player'){
                if(tweenable.targetOfInterest == tweenable.channel.id){
                  //TODO add if tracking player update camera position  
                  end = new Vector3().copyFrom(player.position)//is copy required? flyweight for vector storage?
                }else{
                  //not me must hope for a sync
                }
              }

              const endDest = computeMoveVector(start,end,tweenable.lockX,tweenable.lockY,tweenable.lockZ,tweenable.percentOfDistanceToTravel,tweenable.moveNoCloserThan);

              tweenable.x = endDest.x
              tweenable.y = endDest.y
              tweenable.z = endDest.z

              //keep updating origin for smooth follow?
              //TODO why does move require setting this but not rotateq?
              if(tweenable.repeatAction == 'relative'){
                if(!tweenable.origin || tweenable.origin !== Vector3){
                  tweenable.origin = new Vector3()
                }
                tweenable.origin.copyFrom(transform.position)
              }
              
            }
          }
          
          const offset = offsetFactory(tweenable, start)
          const end = new Vector3(offset('x'), offset('y'), offset('z'))

          if (tweenable.transition >= 0 && tweenable.transition < 1) {
            tweenable.transition += dt * speed
            
            let easingIndex = 0;
            if(tweenable.repeatAction == 'relative' && tweenable.trackingType && tweenable.trackingType == 'follow'){
              //when doing follow should not be on a curve
              easingIndex = dt * speed
            }else{
              easingIndex = easingConverter(
                tweenable.transition,
                tweenable.curve
              )
            }

            transform.position.copyFrom(Vector3.Lerp(start, end, easingIndex))
          } else if (tweenable.transition >= 1) {
            if(this.logger.isDebugEnabled()) this.logger.debug( METHOD_NAME,tweenable.type + " " +  entity.name + " ended; repeatAction:" + tweenable.repeatAction, null )
            
            if(!tweenable.repeatAction || tweenable.repeatAction == 'none'){
              tweenable.transition = -1
              transform.position.copyFrom(end)
              //log('rotate calling remove entity ' + this.constructor.name)
              this.removeComponent(entity)

              // send actions
              tweenable.channel.sendActions(tweenable.onComplete)
            }else{
              if(tweenable.targetOfInterestType == 'player'){
                if(tweenable.targetOfInterest == tweenable.channel.id){
                  //TODO add if tracking player update camera position  
                  //send sync action for new position
                }else{
                  //not me must hope for a sync
                }
              }
              if(tweenable.repeatAction == 'relative'){
                //log("move relative loop starting again")
                let origPos:Vector3 = tweenable.origin;

                //mutate end and start
                //RISK never stopping getting too big
                tweenable.origin=transform.position.clone()

                //should scale relative to the diff between last orig and now
                tweenable.x+=tweenable.x-origPos.x
                tweenable.y+=tweenable.y-origPos.y
                tweenable.z+=tweenable.z-origPos.z

                //go back to 0 and if over shot etc. adjusts so its smooth
                tweenable.transition = tweenable.transition - 1;
              }else if(tweenable.repeatAction == 'reverse'){
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
                transform.position.copyFrom(end)

                //log("scale reverse before" + tweenable.origin.x + " " + tweenable.origin.y + " " + tweenable.origin.z 
                //  + " vs " + tweenable.x + " " + tweenable.y + " " + tweenable.z)

                //mutate end and start
                let origPos:Vector3 = tweenable.origin;
                tweenable.origin=end.clone()
                
                tweenable.x=origPos.x
                tweenable.y=origPos.y
                tweenable.z=origPos.z

                //log("scale reverse after" + tweenable.origin.x + " " + tweenable.origin.y + " " + tweenable.origin.z 
                //  + " vs " + tweenable.x + " " + tweenable.y + " " + tweenable.z)
              }else{//repeat abs
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
              }
            }

          }
          break
        }
        case 'rotate': {
          if(tweenable.trackingType && tweenable.trackingType != 'current'){
            if(trackingTweenable && tweenable.trackingType == 'meet'){
              if(!tweenable.lockX) tweenable.x = trackingTweenable.x
              if(!tweenable.lockY) tweenable.y = trackingTweenable.y
              if(!tweenable.lockZ) tweenable.z = trackingTweenable.z
            }else if( trackingTransform && tweenable.trackingType == 'follow'){
              const eulerAngles = trackingTransform.rotation.eulerAngles;
              if(!tweenable.lockX) tweenable.x = eulerAngles.x
              if(!tweenable.lockY) tweenable.y = eulerAngles.y
              if(!tweenable.lockZ) tweenable.z = eulerAngles.z

              //keep updating origin for smooth follow?!?!
            }
          }
          const start = Quaternion.Euler(
            tweenable.origin.x,
            tweenable.origin.y,
            tweenable.origin.z
          )
          const end = start.multiply(
            Quaternion.Euler(tweenable.x, tweenable.y, tweenable.z)
          )

          if (tweenable.transition >= 0 && tweenable.transition < 1) {
            tweenable.transition += dt * speed
            let easingIndex = easingConverter(
              tweenable.transition,
              tweenable.curve
            )
            transform.rotation.copyFrom(
              Quaternion.Slerp(start, end, easingIndex)
            )
          } else if (tweenable.transition >= 1) {
            if(this.logger.isDebugEnabled()) this.logger.debug( METHOD_NAME,tweenable.type + " " +  entity.name + " ended; repeatAction:" + tweenable.repeatAction, null )

            if(!tweenable.repeatAction || tweenable.repeatAction == 'none'){
              tweenable.transition = -1
              transform.rotation.copyFrom(end)
              this.removeComponent(entity)

              // send actions
              tweenable.channel.sendActions(tweenable.onComplete)
            }else{
              if(tweenable.repeatAction == 'relative'){
                //mutate end and start
                let rotEuler:Vector3 = transform.rotation.clone().eulerAngles;
                tweenable.origin=rotEuler
                //go back to 0 and if over shot etc. adjusts so its smooth
                tweenable.transition = tweenable.transition - 1;
              }else if(tweenable.repeatAction == 'reverse'){
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
                transform.rotation.copyFrom(end)

                //log("rotate repeat before" + tweenable.origin.x + " " + tweenable.origin.y + " " + tweenable.origin.z 
                //  + " vs " + tweenable.x + " " + tweenable.y + " " + tweenable.z)

                //mutate end and start
                tweenable.origin=end.clone().eulerAngles
                
                //euler rotation is relative so just negate it
                tweenable.x=tweenable.x*-1
                tweenable.y=tweenable.y*-1
                tweenable.z=tweenable.z*-1

                //log("rotate repeat after" + tweenable.origin.x + " " + tweenable.origin.y + " " + tweenable.origin.z 
                //  + " vs " + tweenable.x + " " + tweenable.y + " " + tweenable.z)
              }else{//repeat abs
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
              }
            }
          }
          break
        }
        case 'rotate-q': {
          if(tweenable.trackingType && tweenable.trackingType != 'current'){
            if(trackingTweenable && tweenable.trackingType == 'meet'){
              let lookAtTarget = new Vector3(trackingTweenable.x,trackingTweenable.y,trackingTweenable.z);//flyweight to avoid new object each time?
              let endRotation:Quaternion = computeFaceAngle(lookAtTarget,transform,tweenable.lockMode,tweenable.lockX,tweenable.lockY,tweenable.lockZ);
              tweenable.x = endRotation.x
              tweenable.y = endRotation.y
              tweenable.z = endRotation.z
              tweenable.w = endRotation.w
            }else if(tweenable.trackingType == 'follow'){
              let lookAtTarget = new Vector3().copyFrom(trackingTransform.position)
                
              if(trackingTransform){
                lookAtTarget = new Vector3().copyFrom(trackingTransform.position)//is copy required? flyweight for vector storage?
              }else if(tweenable.targetOfInterestType == 'player'){
                if(tweenable.targetOfInterest == tweenable.channel.id){
                  //TODO add if tracking player update camera position  
                  lookAtTarget = new Vector3().copyFrom(player.position)//is copy required? flyweight for vector storage?
                }else{
                  //not me must hope for a sync
                }
              }
              
              let endRotation:Quaternion = computeFaceAngle(lookAtTarget,transform,tweenable.lockMode,tweenable.lockX,tweenable.lockY,tweenable.lockZ);
              tweenable.x = endRotation.x
              tweenable.y = endRotation.y
              tweenable.z = endRotation.z
              tweenable.w = endRotation.w

              //keep syncing origin for smooth follow???
              //TODO why does move require setting this but not rotateq?
              //its cuz computeFaceAngle takes object itself instead of a copied var of position/rotate
              //if(tweenable.repeatAction == 'relative'){
                //tweenable.originQ = transform.rotation
              //}
            }
          }
          //log("rotate-q " + tweenable.transition +  " "  + tweenable.destPosition +  " " + tweenable.x +  " " + tweenable.y +  " " + tweenable.z +  " " + tweenable.w)
          const start = tweenable.originQ //
          const end = new Quaternion(tweenable.x, tweenable.y, tweenable.z,tweenable.w)
          
          if (tweenable.transition >= 0 && tweenable.transition < 1) {
            tweenable.transition += dt * speed

            let easingIndex = 0;
            if(tweenable.repeatAction == 'relative' && tweenable.trackingType && tweenable.trackingType == 'follow'){
              //when doing follow should not be on a curve
              easingIndex = dt * speed
            }else{
              easingIndex = easingConverter(
                tweenable.transition,
                tweenable.curve
              )
            }
            
            transform.rotation.copyFrom(
              Quaternion.Slerp(start, end, easingIndex)
            )
    
          } else if (tweenable.transition >= 1) {
            if(this.logger.isDebugEnabled()) this.logger.debug( METHOD_NAME,tweenable.type + " " +  entity.name + " ended; repeatAction:" + tweenable.repeatAction, null )

            if(!tweenable.repeatAction || tweenable.repeatAction == 'none'){
              tweenable.transition = -1
              transform.rotation.copyFrom(end)
              this.removeComponent(entity)

              // send actions
              tweenable.channel.sendActions(tweenable.onComplete)
            }else{
              if(tweenable.targetOfInterestType == 'player'){
                if(tweenable.targetOfInterest == tweenable.channel.id){
                  //TODO add if tracking player update camera position  
                  //send sync action for new position
                }else{
                  //not me must hope for a sync
                }
              }
              if(tweenable.repeatAction == 'relative'){
                //log("move relative loop starting again")
                //mutate end and start
                tweenable.originQ=transform.rotation;//.clone() clone not needed?
                //go back to 0 and if over shot etc. adjusts so its smooth
                tweenable.transition = tweenable.transition - 1;
              }else{//repeat abs
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
              }
            }
          }
          break
        }
        
        case 'follow-path': {
          
          //const start = tweenable.originQ
          //const end = new Quaternion(tweenable.x, tweenable.y, tweenable.z,tweenable.w)
          
          //TODO adjust speed to match norms.  so divide speed additionally by segment count
          //that way speed is normalized for all actions

          if (tweenable.transition >= 0 && tweenable.transition < 1) {
            //tweenable.transition += dt * speed
            //segments / time to complete??? does dt play into this? should it?
            //need to decide where in the path count i am + subfraction
            let easingIndex = easingConverter(
              tweenable.transition,
              tweenable.curve
            )
              //TODO figure out how to use easing curve as part of path fraction
              let path = null;//entity.getComponent(PathData)

              if(entity.hasComponent(PathData)){
                path = entity.getComponent(PathData)
              
                //log("follow-path " + tweenable.transition + " " +  path.target  + "/"  + path.path.length + " " + tweenable.transition + " dt " + dt + " speed:" + speed + " path.fraction" + path.fraction )
              
                let pathSpeed:number = speed;//TODO use class PathSpeed
                //speed = shark.getComponent(SwimSpeed)
                //log("followItemPath move lerping")
                if(true){//if (path.fraction < 1) {
                  transform.position = Vector3.Lerp(
                    path.path[path.origin],
                    path.path[path.target],
                    path.fraction
                    )
                  path.fraction += pathSpeed/10
                }
                if (path.fraction > 1) {

                  let sqDistOrigins = Vector3.Distance(path.originVector, path.path[path.origin])

                  //log("follow-path next segment origin " + path.originVector + " sqDist" + sqDistOrigins + " "  + tweenable.transition + " " +  path.target  + "/"  + path.path.length + "; " + path.path[path.origin] + ">" + path.path[path.target])
                  path.origin = path.target
                  path.target += 1
                  if (path.target >= path.path.length-1) { //go back to first target
                    path.target = 0
                  }
                  if(path.target == path.start){//if repeat enabled? do that?
                    tweenable.transition = 1
                  }
                  path.fraction = 0      
                }
              
                // Rotate gradually with a spherical lerp
                //for (let shark of sharks.entities){
                //let transform = shark.getComponent(Transform)
                //let path = shark.getComponent(PathData)
                let rotate = null;
                if(entity.hasComponent(RotateData)){
                  rotate = entity.getComponent(RotateData)
                  //let speed = shark.getComponent(SwimSpeed)
                  rotate.fraction +=  pathSpeed/10

                  if (rotate.fraction > 1) {
                    rotate.fraction = 0
                    rotate.originRot = transform.rotation

                    //log("followItemPath rot lerping  " + " " + path.path[path.target] + " " + path.path[path.origin]) 

                    let direction = path.path[path.target].subtract(path.path[path.origin]).normalize()
                    rotate.targetRot = Quaternion.LookRotation(direction)
                    
                    if(rotate.lockX) rotate.targetRot.x = rotate.startingRot.x
                    if(rotate.lockY) rotate.targetRot.y = rotate.startingRot.y
                    if(rotate.lockZ) rotate.targetRot.z = rotate.startingRot.z
                    if(rotate.lockW) rotate.targetRot.w = rotate.startingRot.w //if using euler dont set W use urler rotation
                  } 
                  //log("followItemPath rot slerping  " + " " + rotate.originRot + " " + rotate.targetRot) 
                  if(rotate.originRot&&rotate.targetRot){
                    transform.rotation = Quaternion.Slerp(
                      rotate.originRot,
                      rotate.targetRot,
                      rotate.fraction
                    )
                  }else{
                    //should it be blank off the bat?
                    //blank before moving first segment normal?
                  }
                }
                
              //}
              }else{
                log("followItemPath not path yet")
              }
              

          } else if (tweenable.transition >= 1) {
            if(this.logger.isDebugEnabled()) this.logger.debug( METHOD_NAME,tweenable.type + " " +  entity.name + " ended; repeatAction:" + tweenable.repeatAction, null )

            if(!tweenable.repeatAction || tweenable.repeatAction == 'none'){
              tweenable.transition = -1
              //transform.rotation.copyFrom(end)
              this.removeComponent(entity)
              entity.removeComponent(PathData)
              entity.removeComponent(RotateData)

              // send actions
              tweenable.channel.sendActions(tweenable.onComplete)
            }else{
              //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
              tweenable.transition = tweenable.transition - 1;
            }
          }
          break
        }
        case 'scale': {
          if(tweenable.trackingType && tweenable.trackingType != 'current'){
            if(tweenable.trackingType == 'meet' && trackingTweenable){
              tweenable.x = trackingTweenable.x
              tweenable.y = trackingTweenable.y
              tweenable.z = trackingTweenable.z
            }else if(tweenable.trackingType == 'follow' && trackingTransform){
              tweenable.x = trackingTransform.scale.x
              tweenable.y = trackingTransform.scale.y
              tweenable.z = trackingTransform.scale.z
            }
          }
          const start = tweenable.origin
          const offset = offsetFactory(tweenable, start)
          const end = new Vector3(offset('x'), offset('y'), offset('z'))

          if (tweenable.transition >= 0 && tweenable.transition < 1) {
            tweenable.transition += dt * speed
            let easingIndex = easingConverter(
              tweenable.transition,
              tweenable.curve
            )
            transform.scale.copyFrom(Vector3.Lerp(start, end, easingIndex))
          } else if (tweenable.transition >= 1) {
            if(this.logger.isDebugEnabled()) this.logger.debug( METHOD_NAME,tweenable.type + " " +  entity.name + " ended; repeatAction:" + tweenable.repeatAction, null )

            if(!tweenable.repeatAction || tweenable.repeatAction == 'none'){
              tweenable.transition = -1
              transform.scale.copyFrom(end)
              this.removeComponent(entity)

              // send actions
              tweenable.channel.sendActions(tweenable.onComplete)
            }else{
              if(tweenable.repeatAction == 'relative'){
                let origScale:Vector3 = tweenable.origin;

                //mutate end and start
                //RISK never stopping getting too big
                tweenable.origin=transform.scale.clone()

                //should scale relative to the diff between last orig and now
                tweenable.x+=tweenable.x-origScale.x
                tweenable.y+=tweenable.y-origScale.y
                tweenable.z+=tweenable.z-origScale.z

                //go back to 0 and if over shot etc. adjusts so its smooth
                tweenable.transition = tweenable.transition - 1;
              }else if(tweenable.repeatAction == 'reverse'){
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
                transform.scale.copyFrom(end)

                //log("scale reverse before" + tweenable.origin.x + " " + tweenable.origin.y + " " + tweenable.origin.z 
                //  + " vs " + tweenable.x + " " + tweenable.y + " " + tweenable.z)

                //mutate end and start
                let origScale:Vector3 = tweenable.origin;
                tweenable.origin=end.clone()
                
                tweenable.x=origScale.x
                tweenable.y=origScale.y
                tweenable.z=origScale.z

                //log("scale reverse after" + tweenable.origin.x + " " + tweenable.origin.y + " " + tweenable.origin.z 
                //  + " vs " + tweenable.x + " " + tweenable.y + " " + tweenable.z)
              }else{//repeat abs
                //go back to 0 and if over shot etc. adjusts so its smooth and keeps in sync
                tweenable.transition = tweenable.transition - 1;
              }
            }
          }
          break
        }
      }
    }
  }
}

//concreatly instantiating each system incase i want to overload methods
export class TweenSystemMove extends TweenSystem<TweenableMove>{
  constructor(){
    super(TweenableMove)
    log("TweenSystemMove.contructor() called")
  }
  getClassName():string{ //if minified not sure can trust this?!?!
    return "TweenSystemMove";//this.constructor.name
  }
}
export class TweenSystemRotate extends TweenSystem<TweenableRotate>{
  constructor(){
    super(TweenableRotate)
    log("TweenSystemRotate.contructor() called")
  }
  getClassName():string{ //if minified not sure can trust this?!?!
    return "TweenSystemRotate";//this.constructor.name
  }
}
export class TweenSystemScale extends TweenSystem<TweenableScale>{
  constructor(){
    super(TweenableScale)
    log("TweenSystemScale.contructor() called")
  }
  getClassName():string{ //if minified not sure can trust this?!?!
    return "TweenSystemScale";//this.constructor.name
  }
}


export enum CurveType {
  LINEAR = 'linear',
  INSTANTANEOUS = 'instantaneous',

  EASEINSINE = 'easeinsine',
  EASEOUTSINE = 'easeoutsine',
  EASEINOUTSINE = 'easeinoutsine',

  EASEINQUADRATIC = 'easeinquadratic',
  EASEOUTQUADRATIC = 'easeoutquadratic',
  EASEINOUTQUADRATIC = 'easeinoutquadratic',

  EASEINCUBIC = 'easeincubic',
  EASEOUTCUBIC = 'easeoutcubic',
  EASEINOUTCUBIC = 'easeinoutcubic',

  EASEINEXPO = 'easeinexpo',
  EASEOUTEXPO = 'easeoutexpo',
  EASEINOUTEXPO = 'easeinoutexpo',

  EASEINELASTIC = 'easeinelastic',
  EASEOUTELASTIC = 'easeoutelastic',
  EASEINOUTELASTIC = 'easeinoutelastic',

  EASEINBOUNCE = 'easeinbounce',
  EASEOUTEBOUNCE = 'easeoutbounce',
  EASEINOUTBOUNCE = 'easeinoutbounce',
}

export function easingConverter(x: number, curveType: CurveType) {
  switch (curveType) {
    case CurveType.LINEAR:
      return x
      break
    case CurveType.INSTANTANEOUS:
      return 1
      break
    case CurveType.EASEINSINE:
      return 1 - Math.cos((x * Math.PI) / 2)
      break
    case CurveType.EASEOUTSINE:
      return Math.sin((x * Math.PI) / 2)
      break
    case CurveType.EASEINOUTSINE:
      return -(Math.cos(Math.PI * x) - 1) / 2
      break
    case CurveType.EASEINQUADRATIC:
      return x * x
      break
    case CurveType.EASEOUTQUADRATIC:
      return 1 - (1 - x) * (1 - x)
      break
    case CurveType.EASEINOUTQUADRATIC:
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
      break

    case CurveType.EASEINCUBIC:
      return x * x * x
      break
    case CurveType.EASEOUTCUBIC:
      return 1 - Math.pow(1 - x, 3)
      break
    case CurveType.EASEINOUTCUBIC:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
      break
    case CurveType.EASEINEXPO:
      return x === 0 ? 0 : Math.pow(2, 10 * x - 10)
      break
    case CurveType.EASEOUTEXPO:
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
      break
    case CurveType.EASEINOUTEXPO:
      return x === 0
        ? 0
        : x === 1
        ? 1
        : x < 0.5
        ? Math.pow(2, 20 * x - 10) / 2
        : (2 - Math.pow(2, -20 * x + 10)) / 2
      break

    case CurveType.EASEINELASTIC:
      const c4 = (2 * Math.PI) / 3

      return x === 0
        ? 0
        : x === 1
        ? 1
        : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)
      break
    case CurveType.EASEOUTELASTIC:
      const c5 = (2 * Math.PI) / 3

      return x === 0
        ? 0
        : x === 1
        ? 1
        : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c5) + 1
      break

    case CurveType.EASEINOUTELASTIC:
      const c6 = (2 * Math.PI) / 4.5

      return x === 0
        ? 0
        : x === 1
        ? 1
        : x < 0.5
        ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c6)) / 2
        : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c6)) / 2 + 1
      break

    case CurveType.EASEINBOUNCE:
      return 1 - bounce(1 - x)
      break
    case CurveType.EASEOUTEBOUNCE:
      return bounce(x)
      break
    case CurveType.EASEINOUTBOUNCE:
      return x < 0.5 ? (1 - bounce(1 - 2 * x)) / 2 : (1 + bounce(2 * x - 1)) / 2
      break
  }
}

function bounce(x: number) {
  const n1 = 7.5625
  const d1 = 2.75

  if (x < 1 / d1) {
    return n1 * x * x
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375
  }
}

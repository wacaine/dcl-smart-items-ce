export const getEntityByName = (name: string) =>
  Object.keys(engine.entities)
    .map((key) => engine.entities[key])
    .filter((entity) => (entity as Entity).name === name)[0]

export function computeFaceAngle(lookAtTarget:Vector3,transform:Transform,lockMode:string,lockX:boolean,lockY:boolean,lockZ:boolean) {
    let lockW = false
        /*
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
        */
        
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
    
export function computeMoveVector(start:Vector3,endDest:Vector3,lockX:boolean,lockY:boolean,lockZ:boolean,percentOfDistanceToTravel:float,moveNoCloserThan:float){
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
    if(distanceDelta < .0001){
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

    
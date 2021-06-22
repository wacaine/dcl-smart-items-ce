# Improving the Toolbox Smart Item In Builder

# My Goal
I want to enable those who are not developers, do not know the SDK or programming language to still be able to create beautiful dynamic scenes.  I am an active user of the Builder tool (see my portfolio below) and I am very familiar with the Builder's current limitations.  I want to make the Builder better.  By adding richer / more configurable smart items to the Builder I believe those smart items will help enable users to create better more dynamic scenes.

*This will not be my only proposal for smart item improvements.  I am submitting each proposal separately to focus on the scope of work.  It also ensures I am only working on what the work the community finds valuable.*

If need be I will manage corrections/updates to this proposal in the github repo here a I do not think I can make updates after submission.  https://github.com/wacaine/dcl-smart-items-ce/proposals/toolbox-ce.md

# Proposal

Add more functionality to the toolbox smart item to enable users to make more dynamic scenes

I will list the updates and then provide more detail below

* Add a set of "Face Player/Item" and "Move to Player/Item"
* Add "Follow path"
* Improve the  Move/Rotate/Scale code (TweenSystem) to be able to run 1 move,1 rotate,1 scale concurrently. Currently limited where only 1 action can be executed at a time move or rotate or scale.  
* Scene Add/remove
* Attach/Detach Item


Add a set of "Face Player/Item" and "Move to Player/Item" actions to the toolbox smart item.  This will allow the user a more visual and dynamic way of targeting movements.  Instead of having to hardcode in x,y,z they can instead say "move item A to item B".  It is more dynamic this way if item B is moved by some other action programming is not required to update the target of x,y,z.  As item B is moved around the action "move item A to item B" will remain up to date.    It also lends itself to a visual drag-drop targeting model instead of having to know a coordinate system.

The toolbox smart item today supports syncing the state for multiplayer.  The  "Face Player/Item" and "Move to Player/Item" will also support multiplayer and be visible/update to all players

I will provide a Community Edition (CE) of the toolbox smart item that can be dragged into Builder to be used as a custom item (as described here https://docs.decentraland.org/builder/import-items/).  I will also work with the Decentraland Foundation Team to try and get it merged into the main smart item Decentraland repository so it is there for use by everyone without extra import steps.

# Actions To Be Added

All actions to be multiplayer syncale (one player performs action all players will see it) through use of message bus.

### Face player 
The target item will rotate towards the player at a configurable speed for how fast it rotates and stops when facing the player.

### Face Item
The target item will rotate towards the target item at a configurable speed for how fast it rotates and stops when facing the player

### Move to player 
The target item will move towards the player who invoked it at a configurable speed for how fast it rotates and stops when facing the player

### Move to item
The target item will move towards the item at a configurable speed for how fast it rotates and stops when facing the player.

### Note on above
All of the above face/move actions will include lock X, Y, Z-axis which do as they suggest.  It will prevent movement along the locked axis.  This is useful if you wanted to move an item to the same Y coordinate as another item but update any other axis (basically have it move only in the up/down direction). 

### Follow Item Path 
The target item will follow a path of defined items.  This is like move to item however you list more than one item.  It will also not follow the path strictly but more of a curved path AND rotate the object-oriented facing forward along the path.  I do have a POC of this working however the Builder action UI is limited and I see no way to be able to pick an unlimited amount of items.   I must pre-configure the max number of selectable items.  I am also not sure how nicely this will work with multi-player.  I plan on leaving this just as an advanced feature only the CE repo will have and not try to pull it into the main repo.

### Motion Control 
Allows a player to pause, stop, resume an action

### Improve the Move/Rotate/Scale code (TweenSystem) 
Currently, you can execute just one Rotation, Move, or Scale at a time.  Executing two at the same time will cancel one of them out.  I want to add the ability to enable 1 Rotation + 1 Move + 1 Scale all at the same time.    More than 1 of these actions at the same time will have the same cancelation effect as the first just like today but only against that action type: move, rotate or scale.

### Add Attach/Detach Item
Will attach 1 item to another giving the attached item the position, rotation, scale of the target/host object.  This is very useful to move items in one group instead of individually.  Attach centered flag.  

### Scene Add/remove
Action will let you remove/add an object.  Not the most elegant way to handle the user experience object/movement but has its uses.  One is removed objects do not contribute to scene limitations and boost scene performance. 

# Stretch Goal Deliverables

"Change Visibility" action will let you hide/show an object.  Not the most elegant way to handle the user experience object/movement but has its uses.  One is hidden objects do not contribute to scene limitations and boost scene performance.  (Must solve hide Shape or remove entity completely)

Scale improvement.  Add hide/show when below a threshold.

Add "Run on start" so actions can be started right away (on scene load)  instead of the player having to activate a trigger/click etc.  Not sure this is safe as each user starts the scene it will trigger the message bus.  At which point how do we keep new users entering the scene later from "resetting the scene"?

"Start facing player" - the target item will rotate towards the player at a configurable speed for how fast it follows.

"Stop facing player" - the target item will stop facing the player.   The item will remain in the orientation it last was in before receiving the stop command.



# Out of scope

Not supporting multi-player for "Start facing player".  This effect will be relative to the player, not the world as a whole.  Keeping the scene in sync with other players and who it is facing and where they are can be a later enhancement.  If there is another user in the scene they will not see following the user effect.  The best I can do is use "Face Player" so it sort of is a representation of the action.


# Demo / POC

I started work the same day I saw the DAO Funding proposal as a POC and you can see the work I have completed here 

[https://share.decentraland.org/b/scene/77318ec4-638b-4543-a727-688f51b371ce] (https://share.decentraland.org/b/scene/77318ec4-638b-4543-a727-688f51b371ce)

I estimate I have about 70% of the deliverable complete.   I am optimistic that this proposal will be approved because I believe in the value of adding the toolbox functionality (I have already logged more hours than I probably should have not knowing if this will be funded or not).  Should the funding be approved I will finalize my work and make it available as outlined in the deliverables below.

# Deliverables

The code will be publicly available at my public GitHub repository here. https://github.com/wacaine/dcl-smart-items-ce.  The reasoning for the name of the repository: "smart-items" since that is what they are and "ce"  for Community Edition.  I will upload the source code and a premade item.zip that can be dragged into the builder for usage.  Directions on how to do that can be found here https://docs.decentraland.org/builder/import-items/

I will also open a pull request against the main smart-items repository (here https://github.com/decentraland/smart-items).   I will work with the Decentraland Foundation team to try and get it merged into the main repo so it will be even easier to make use of.  There is no guarantee the Decentraland Foundation will merge this code into the main branch.  This step is dependent on the Decentraland Foundation Team time to review, code standards, other projects/goals they have going on, and likely not be completed as quickly as the custom drag/drop item.


# Time to Complete

I am past the 70% completion mark already.  I estimate at most more 2-weeks until completion from the time the proposal is accepted (sadly this is not my full-time job...yet! :) ).  Should the funding be approved I will finalize the work I have already started and make it available as outlined in the deliverables above.

# My Portfolio

I won first place in the recent CyberPunk Contes that included a mini-game.  In the mini-game, I had to disable access to areas, disable platforms, keep track of how many times a user did something.  I exclusively used the Builder and the provided smart items to make my scene.  In doing so I am very familiar with the Builder and smart item current limitations.

[https://decentraland.org/blog/announcements/cyberpunk-2021-meet-the-winners/] (https://decentraland.org/blog/announcements/cyberpunk-2021-meet-the-winners/)
View it in the scene pool here [https://builder.decentraland.org/view/pool/2b1522a0-3768-426f-990b-9cd716d9cb20] (https://builder.decentraland.org/view/pool/2b1522a0-3768-426f-990b-9cd716d9cb20)

I have made improvements to existing smart items.  You can see my pull request to fix a bug found in the CyberPunk image cube item.
https://github.com/decentraland/smart-items/pull/27  

Another contest submission for the Voxter Contest involved a smart asset they provided.  You can find my submission here:
[https://builder.decentraland.org/view/pool/a1890011-77d7-415c-aeb2-452e3a186391?realm=localhost-stub](https://builder.decentraland.org/view/pool/a1890011-77d7-415c-aeb2-452e3a186391?realm=localhost-stub). Again I used the Builder and but this time also the SDK to enhance the Voxter smart item given to the contestants improving its experience and features in the Builder.  Enhancements can be found here:
[https://github.com/pabloes/voxters/pull/2] (https://github.com/pabloes/voxters/pull/2)







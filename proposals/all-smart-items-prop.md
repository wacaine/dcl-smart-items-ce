# Enhance All Builder Smart Items Feedback Cues; Improve Triggers, Counters, Text



# Proposal

Enhance Builder smart items enough so they are capable of creating scene-size dynamic games like Pong or Breakout.  There are 254 smart items found in the Builder.  Some are +2 years old, most checked in and never touched again.  I will revisit all the smart items and add functionality where lacking.  

Summary of work:

* Add more dynamic functionality to a targeted subset of smart items: Trigger Type, Counter Type, Text Displaying Types, Toolbox
* Improve user feedback by adding enabling/disabling clickable + customizable hover text feature
* Make the smart item code more scene efficient by reducing re-creation of objects where not needed

#### Demo / POC

https://share.decentraland.org/b/scene/badd0bda-4f80-4372-af4d-092841097557

# Description

Full Project Proposal Here https://github.com/wacaine/dcl-smart-items-ce/blob/master/proposals/all-smart-items-prop.md


### Adding more dynamic functionality for the very specific subset of smart items  


##### Trigger Types

Includes: Trigger Area, Trigger Round, Trigger Tile SciFi, Trigger Tile Square

I want to upgrade the code to the trigger system code found https://github.com/decentraland/decentraland-ecs-utils.   This upgrade will extend the current user entered/exited triggers.  It will add the ability to detect when objects interact with other objects and also define what objects can interact with other objects.  Interact here means when the bounds of 2 trigger boxes intersect with each other.  An example: Food is triggered (or eaten) by both cats or mice. Also, mice are eaten by cats, so a mouse's trigger area is triggered by only cats (not the food or other mice).

##### Counter Types

Includes: Scoreboard, Countdown timers

Scoreboard for example, only when the target value is reached can it trigger an event.  Define more triggerable events as the counter is incremented or decremented.  Events such as trigger when increments by 1, nears the target value, reset etc..


##### Text Displaying Types 

Includes: Plain Text, Galleries

Be able to change the text, font, color by an action event


##### Toolbox Add Bounce Action

Toolbox currently manages object motion.  To be able to get dynamic movement more at least one more action needs to be added.  Bounce will take the current motion and calculate its bounce off an object/bounds.  It will calculate the most basic bounce trajectory of an object and purely reflect the direction.  It will not consider the object's mass, shape or rotation at the point of collision.  If it is possible to gain access to the object's shape and mass to determine a better angle and a more realistic bounce this will be a stretch goal.  

Bounce will have a few parameters like " elasticity" or how bouncy the collision is.  It can either dampen the bounce or speed it up.



### Make smart items more scene efficient.  

##### Add more user feedback

The user feedback on smart items is not very flexible or lacking (see General Audit provided below).   If they do have onClick events many times the hover text cannot be changed.  I want to add onClick events to more of the smart items as well as additional configuration abilities like changing the hover text.

##### Some examples of better user feedback:

The Fantasy Black Button text says "Press" and cannot be changed to "Press to open door" for example.  Or if the builder chooses not clickable at all that is not possible either.

The Blender smart item is clickable but the hover text is not changeable it just says "Interact".  Would it not be more fun if the hover text could be changed to "Make smoothie".  Or if the builder chooses not clickable at all that is not possible either.

The Trapdoor is not clickable nor has hover text.  While that is likely because it is supposed to be a secret trap door what if someone wants it to have this ability.  Make clickable with hover text "Open secret door"



# Specifications

### Demo / POC

You can see the work I started here 

https://share.decentraland.org/b/scene/badd0bda-4f80-4372-af4d-092841097557

### General Audit

You can see here an audit of all smart items and the features proposed to be added.  https://docs.google.com/spreadsheets/d/1VB-4osSEVUW0AobdsLCokq-j6wCve9Aytam5wYyZlag/edit?usp=sharing.

* Name (Column B) gives the smart item name
* Existing Actions/Parameters (Columns C thru D)
* Audit of features existing or to be added (Columns G thru P)

This is a preliminary audit.  What features are listed in the audit document are subject to change.

71 of the smart items (see General Audit provided above) do not reuse objects where possible.  Each instance of the same smart item re-creates the same object for each instance.  This directly impacts the weight smart items put on your scene when you add many of them.  It should be created once and reused instead.  

### Deliverables

The code will be publicly available at my public GitHub repository here: https://github.com/wacaine/dcl-smart-items-ce.  The reasoning for the name of the repository: "smart-items" since that is what they are and "ce"  for Community Edition.  I will upload the source code and a premade item.zip(s) that can be dragged into the builder for usage.  Directions on how to do that can be found here https://docs.decentraland.org/builder/import-items/

I will also open a pull request against the main smart-items repository (here https://github.com/decentraland/smart-items).   I will work with the Decentraland Foundation team to try and get it merged into the main repo so all these changes will be even easier to make use of.  There is no guarantee the Decentraland Foundation will merge this code into the main branch.  This step is dependent on the Decentraland Foundation Team time to review, code standards, other projects/goals they have going on, and likely not be completed as quickly as the custom drag/drop item.

# Pesonal

I already have one successful approved grant with delivered content. Below are the links to the previous grant, demo scene, and work delivered.  All of this proves I have the experience and skills required for working with smart items

* Past Grant: https://governance.decentraland.org/en/proposal/?id=ba798f30-d382-11eb-b705-3db38bad850a.  
* Demo: https://share.decentraland.org/b/scene/77318ec4-638b-4543-a727-688f51b371ce 
* Deliverables:  https://github.com/wacaine/dcl-smart-items-ce

I won first place in the recent CyberPunk Contes that included a mini-game.  In the mini-game, I had to disable access to areas, disable platforms, keep track of how many times a user did something.  I exclusively used the Builder and the provided smart items to make my scene.  In doing so I am very familiar with the Builder and smart item current limitations.

https://decentraland.org/blog/announcements/cyberpunk-2021-meet-the-winners/
Scene here https://builder.decentraland.org/view/pool/2b1522a0-3768-426f-990b-9cd716d9cb20

You can see my pull request to fix a bug found in the CyberPunk image cube item.
https://github.com/decentraland/smart-items/pull/27  

# Roadmap

### Time to Complete

I estimate roughly 10-weeks until completion from the time the proposal is accepted, there are a lot of items to go through, 254 to be exact (and sadly this is not my full-time job...yet! :).  Should the funding be approved I will start working and make it available as outlined in the deliverables above.

### Status / Progress Communication

The status will be communicated twice a month through this grant forum.   See "Discuss in the Forum" link.   I also have my github repo which will track progress

* Committed Code https://github.com/wacaine/dcl-smart-items-ce/
* Project Work: https://github.com/wacaine/dcl-smart-items-ce/projects/1
* Status: https://github.com/wacaine/dcl-smart-items-ce/wiki/Status:-Enhance-All-Builder-Smart-Items

### Milestones


* Week 1-10 - Make smart items more scene efficient + Add more user feedback (Burn rate of ~25 a week)
* Week 1-2 - Trigger Types + Toolbox Bounce Action
* Week 2-3 - Counter types + Display Text types
* Week 4-6 - Making a Game Demo Scene using Triggers and Counters.  A smattering of other updated items

Week deliverables tentative but give general delivery order*

### Deliverables

The code will be publicly available at my public GitHub repository here: https://github.com/wacaine/dcl-smart-items-ce





### Additional Remarks

It should be noted that each smart item is different in usage and/or purpose and not all these updates will be applicable or may have a proposed feature already.

If you are not aware this is my second smart item grant proposal.  I want to make clear the difference between the two proposals. This (Enhance All Builder Smart Items Feedback Cues; Improve Triggers, Counters, Text) is not to be confused with my grant proposal "Improving the Toolbox Smart Item In Builder" found here https://governance.decentraland.org/en/proposal/?id=ba798f30-d382-11eb-b705-3db38bad850a.  Improving the Toolbox Smart Item In Builder targets only 1 smart item, the toolbox.  That proposal focuses on one very versatile and complex smart item chosen because it would enable the user to make any object more dynamic by being able to improve control over its motion move, rotate, and scale.  The proposal here will focus on ALL the other smart items found in Builder, making general improvements as mentioned above.

### Not in scope

I have a  large amount of work and need to restrict the scope.  I will not spend effort in these areas as I could see easily become large enough to be grants of their own.

* 2 or more player games working perfectly
* Real Physics

While I do plan that all events are broadcasted so all players in the world can see the same general scene events where 2 or more players could play together I am not going to focus my effort on ensuring this works perfectly.   I am aware of libraries like Colyseus/Cannon.js exist and are gaining more integration support in Decentraland SDK.   

The challenges for 2 players/real world physics are thus and why I am not going to try to solve them in this proposal 

* I am targeting to make this work in Builder which does not even run the latest SDK https://governance.decentraland.org/en/proposal/?id=72f3d560-d1f4-11eb-9861-ebb8fcfd58d2.  So not only must I get the framework work inside a smart item but also run in Builder (a stale SDK) and the lastest SDK
* time drift/lag will be a very real concern.
* baking a large library into smart items. see Challenges: Smart items should be standalone
* Putting a very specific framework into the smart item makes it bias.  I think maybe another grant could focus on abstracting to make it more general and the library could be plugged in. 


### Challenges

#### Smart items should be standalone

Smart items are designed to be standalone with no outside dependencies needed.  For the types of smart items I want to update, namely trigger types, I must put the same code in each.  This is not great from a maintenance standpoint since updates now have to be done to each.   Also from a performance perspective, it is not great because each trigger loads and runs the same code in memory.  I have a few ideas on how to leverage 1 set of code across all of a similar type.  

#### Builder on older SDK

Builder is running SDK 6.6.3 (not the latest).  The latest SDK is 6.6.5.  [More on that here](https://governance.decentraland.org/en/proposal/?id=72f3d560-d1f4-11eb-9861-ebb8fcfd58d2).   There are a few things Builder does not do right like rotation.  While I try to get workarounds for issues like these please do not think it is broke.  When deployed on the latest SDK it works correctly
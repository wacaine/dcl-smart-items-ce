export type Props = {
  onClick?: Actions
  hoverTextEnabled?: string
  hoverTextDisabled?: string
  //hoverText?: string
  enabled: boolean
  enableClickable: boolean
  onDisable?: Actions
  onEnable?: Actions
}

export default class Button implements IScript<Props> {
  clip = new AudioClip('sounds/click.mp3')
  gtflShape = new GLTFShape('models/Black_Fantasy_Button.glb')
  active: Record<string, boolean> = {}

  init() {}

  play(entity: Entity) {
    const source = new AudioSource(this.clip)
    entity.addComponentOrReplace(source)
    source.playing = true

    const animator = entity.getComponent(Animator)
    const clip = animator.getClip('trigger')
    clip.stop()
    clip.play()
  }
  
  toggle(entity: Entity, value: boolean, hoverText:string, makeClickable: boolean) {
    if (this.active[entity.name] === value) return

    const pointerDown = entity.getComponent(OnPointerDown)
    if (hoverText !== null && hoverText !== undefined) {
      pointerDown.hoverText=hoverText;
    }
    if(makeClickable !== null && makeClickable !== undefined){
      pointerDown.showFeedback = makeClickable
    }

    this.active[entity.name] = value
  }

  isEnabled(entity: Entity) {
    let retVal = this.active[entity.name] && this.active[entity.name] !== undefined;
    return retVal;
  }

  spawn(host: Entity, props: Props, channel: IChannel) {
    const button = new Entity(host.name + '-button')
    const transmitter = host // or button?!?
    button.setParent(host)

    button.addComponent(this.gtflShape)

    const animator = new Animator()
    const clip = new AnimationState('trigger', { looping: false })
    animator.addClip(clip)
    button.addComponent(animator)

    const enableClickable = (props.enableClickable !== null && props.enableClickable !== undefined) ? props.enableClickable : true
    const enabled = (props.enabled !== null && props.enabled !== undefined) ? props.enabled : true

    const hoverTextEnabled = (props.hoverTextEnabled!=null && props.hoverTextEnabled != '') ? props.hoverTextEnabled : 'Press'
    const hoverTextDisabled = (props.hoverTextDisabled!=null && props.hoverTextDisabled != '') ? props.hoverTextDisabled : 'Press Disabled'

    const startingHoverText = enabled ? hoverTextEnabled : hoverTextDisabled;
    
    //set initial state
    this.active[transmitter.name] = enabled && enableClickable

    button.addComponentOrReplace( new OnPointerDown(
      () => {
        const pushAction = channel.createAction('push', {})
        channel.sendActions([pushAction])
      },
      {
        button: ActionButton.POINTER,
        hoverText: startingHoverText,
        distance: 6,
        showFeedback: enableClickable
      }
    ) )

    channel.handleAction('disableClickable', (action) => {
      this.toggle(transmitter,false,null,false)
    })

    channel.handleAction('enableClickable', (action) => {
      this.toggle(transmitter,true,null,true)
    })

    //channel.handleAction('setHoverText', (action) => {
    //  const { hoverText } = action.values
    //  this.toggle(transmitter,null,hoverText)
    //})

    channel.handleAction('deactivate', (action) => {
      const { sender } = action
      this.toggle(transmitter,false,hoverTextDisabled,null)
      if (sender === channel.id) {
          channel.sendActions(props.onDisable)
      }
    })
    
    channel.handleAction('activate', (action) => {
      const { sender } = action
      this.toggle(transmitter,true,hoverTextEnabled,null)
      if (sender === channel.id) {
          channel.sendActions(props.onEnable)
      }
    })

    channel.handleAction('toggle', ({ sender }) => {
      const newValue = !this.isEnabled(transmitter);
      this.toggle(transmitter, newValue, newValue ? hoverTextEnabled : hoverTextDisabled, null)
      if (sender === channel.id) {
        channel.sendActions(newValue ? props.onEnable : props.onDisable)
      }
    })

    channel.handleAction('push', ({ sender }) => {
      if(this.isEnabled(transmitter)){
        this.play(button)

        if (sender === channel.id) {
            channel.sendActions(props.onClick)
        }
      }
    })
    
    // sync initial values
    //TODO must create syncobject to pass more than 1 value
    channel.request<boolean>('syncEntity', enabled => {
      this.active[transmitter.name] = enabled
    })
    channel.reply<boolean>('syncEntity', () => this.isEnabled(transmitter))
    
  }
}

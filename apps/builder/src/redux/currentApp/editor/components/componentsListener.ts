import {
  getCanvas,
  searchDsl,
} from "@/redux/currentApp/editor/components/componentsSelector"
import { AppListenerEffectAPI, AppStartListening } from "@/store"
import { Unsubscribe, isAnyOf, AnyAction } from "@reduxjs/toolkit"
import { componentsActions } from "@/redux/currentApp/editor/components/componentsSlice"
import { getReflowResult } from "@/page/App/components/DotPanel/calc"
import { ComponentNode } from "./componentsState"
import { configActions } from "@/redux/config/configSlice"

function handleCopyComponentReflowEffect(
  action: ReturnType<typeof componentsActions.copyComponentReducer>,
  listenApi: AppListenerEffectAPI,
) {
  const rootState = listenApi.getState()
  const rootNode = getCanvas(rootState)
  const componentNodes = action.payload
  const effectResultMap = new Map<string, ComponentNode>()
  componentNodes.forEach((copyShape) => {
    const { oldComponentNode } = copyShape
    const parentNodeDisplayName = oldComponentNode.parentNode
    let parentNode = searchDsl(rootNode, parentNodeDisplayName)
    if (!parentNode) {
      return
    }
    if (effectResultMap.has(parentNode.displayName)) {
      parentNode = effectResultMap.get(parentNode.displayName) as ComponentNode
    }
    const childrenNodes = parentNode.childrenNode
    const { finalState } = getReflowResult(
      oldComponentNode,
      childrenNodes,
      false,
    )
    effectResultMap.set(parentNode.displayName, {
      ...parentNode,
      childrenNode: finalState,
    })
  })
  effectResultMap.forEach((value, key) => {
    listenApi.dispatch(
      componentsActions.updateComponentReflowReducer([
        {
          parentDisplayName: key,
          childNodes: value.childrenNode,
        },
      ]),
    )
  })
}

function handleUpdateComponentDisplayNameEffect(
  action: ReturnType<
    typeof componentsActions.updateComponentDisplayNameReducer
  >,
  listenApi: AppListenerEffectAPI,
) {
  const { newDisplayName } = action.payload
  const rootState = listenApi.getState()
  const rootNode = getCanvas(rootState)
  const newComponent = searchDsl(rootNode, newDisplayName)
  if (newComponent) {
    listenApi.dispatch(
      configActions.updateSelectedComponent([newComponent.displayName]),
    )
  }
}

function handleUpdateComponentReflowEffect(
  action: AnyAction,
  listenApi: AppListenerEffectAPI,
) {
  const rootState = listenApi.getState()
  const rootNode = getCanvas(rootState)
  let updateComponents: ComponentNode[] = []
  if (action.type === "components/updateComponentsShape") {
    updateComponents = (action as ReturnType<
      typeof componentsActions.updateComponentsShape
    >).payload.components
  }
  if (action.type === "components/updateComponentContainerReducer") {
    ;(action as ReturnType<
      typeof componentsActions.updateComponentContainerReducer
    >).payload.updateSlice.forEach((slice) => {
      updateComponents.push(slice.component)
    })
  }
  const effectResultMap = new Map<string, ComponentNode>()
  updateComponents.forEach((componentNode) => {
    const parentNodeDisplayName = componentNode.parentNode
    let parentNode = searchDsl(rootNode, parentNodeDisplayName)
    if (!parentNode) {
      return
    }
    if (effectResultMap.has(parentNode.displayName)) {
      parentNode = effectResultMap.get(parentNode.displayName) as ComponentNode
    }
    const childrenNodes = parentNode.childrenNode
    const { finalState } = getReflowResult(componentNode, childrenNodes, false)
    effectResultMap.set(parentNode.displayName, {
      ...parentNode,
      childrenNode: finalState,
    })
  })
  effectResultMap.forEach((value, key) => {
    listenApi.dispatch(
      componentsActions.updateComponentReflowReducer([
        {
          parentDisplayName: key,
          childNodes: value.childrenNode,
        },
      ]),
    )
  })
}

export function setupComponentsListeners(
  startListening: AppStartListening,
): Unsubscribe {
  const subscriptions = [
    startListening({
      actionCreator: componentsActions.copyComponentReducer,
      effect: handleCopyComponentReflowEffect,
    }),
    startListening({
      actionCreator: componentsActions.updateComponentDisplayNameReducer,
      effect: handleUpdateComponentDisplayNameEffect,
    }),
    startListening({
      matcher: isAnyOf(
        componentsActions.updateComponentsShape,
        componentsActions.updateComponentContainerReducer,
      ),
      effect: handleUpdateComponentReflowEffect,
    }),
  ]

  return () => {
    subscriptions.forEach((unsubscribe) => unsubscribe())
  }
}

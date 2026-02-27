using Mirror;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

public class PlayerMouseCursorManager : NetworkBehaviour
{
    public Player player;

    [SyncVar] public int currentItemIndex;
    [SyncVar] public int skillIndex;
    [SyncVar] public bool isTargeting;
    [SyncVar] public Vector3 storedMousePosition;

    public Texture2D defaultCursor;
    public Texture2D targetcursor;
    public Texture2D attackCursor;
    private CursorMode cursorMode = CursorMode.ForceSoftware;
    private Vector2 hotSpot = Vector2.zero;
    private Vector2 defualtSpot = new Vector2(18f, 5f);
    private Vector2 targetSpot = new Vector2(30f, 30f);
    public Vector2 attackSpot = new Vector2(30f, 30f);

    public GameObject aoeCanvas;
    public Projector targetIndicator;

    public int layerMask = 9;

    public Vector3 mouseHitPosition;
    public Vector3 posUp;
    public float maxAbility2Distance;

    public bool isMouseOverUI()
    {
        return EventSystem.current.IsPointerOverGameObject();
    }
    public void Start()
    {
        Cursor.SetCursor(defaultCursor, defualtSpot, cursorMode);
        setDefaultCursor();

        if (player.isLocalPlayer)
        {
            targetIndicator.enabled = false;
        }

    }

    public void Update()
    {

        RaycastHit hit;
        Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);

        if (Physics.Raycast(ray, out hit, Mathf.Infinity, layerMask))
        {
            mouseHitPosition = new Vector3(hit.point.x, hit.point.y, hit.point.z);
        }

        if (Physics.Raycast(ray, out hit, Mathf.Infinity, layerMask))
        {
            if (hit.collider.gameObject != this.gameObject)
            {
                posUp = new Vector3(hit.point.x, hit.point.y, hit.point.z);
                mouseHitPosition = hit.point;
            }
        }
        Quaternion transRot = Quaternion.LookRotation(mouseHitPosition - player.transform.position);

        var hitPosDir = (hit.point - transform.position).normalized;
        float distance = Vector3.Distance(hit.point, transform.position);
        distance = Mathf.Min(distance, maxAbility2Distance);

        var newHitPos = transform.position + hitPosDir * distance;
        aoeCanvas.transform.position = newHitPos;


    }

    public void setTargetCursor()
    {
        Cursor.SetCursor(targetcursor, targetSpot, cursorMode);
        isTargeting = true;
    }

    public void setAttackCursor()
    {
        Cursor.SetCursor(attackCursor, attackSpot, cursorMode);
    }
    public void setLockpickTargetCursor()
    {
        Cursor.SetCursor(targetcursor, targetSpot, cursorMode);
        isTargeting = true;

    }
    [Command]
    public void CmdSetDefaultCursor()
    {
        Cursor.SetCursor(defaultCursor, defualtSpot, cursorMode);

        isTargeting = false;
        currentItemIndex = -1;
        skillIndex = -1;
        targetIndicator.enabled = false;

    }
    [Server]
    public void setDefaultCursor()
    {
        Cursor.SetCursor(defaultCursor, defualtSpot, cursorMode);

        isTargeting = false;
        currentItemIndex = -1;
        skillIndex = -1;
        targetIndicator.enabled = false;
    }
    [Command]
    public void CmdSetTargeting(bool value)
    {
        isTargeting = value;
    }

    [Command]
    public void CmdSetSkillIndex(int index)
    {
        skillIndex = index;
    }

    [Command]
    public void CmdSetCurrentItemIndex(int index)
    {
        currentItemIndex = index;
    }
    private void SetCustomCursor(Texture2D curText)
    {
        Cursor.SetCursor(curText, hotSpot, cursorMode);
    }

    [Command]
    public void CmdSetVector3(Vector3 mousePos)
    {

        storedMousePosition = mousePos;
    }
}

import { runAppleScript, showFailureToast } from "@raycast/utils";
import { Prefs } from "./type";
import { updateCommandMetadata } from "@raycast/api";

export async function execAirPodsMenu(
  { optionOne, optionTwo }: Prefs,
  toggleOption = "",
): Promise<string | null> {
  // On macOS Sequoia and later the Sound controls live inside the Control Center
  // panel (there is no standalone Sound menu-bar item), so we open Control Center,
  // drill into the volume detail view, and drive the checkboxes there. Elements are
  // located by their stable AXIdentifier rather than by locale-dependent labels or
  // fixed indices, so this keeps working regardless of language or how many other
  // audio devices are currently listed.
  //
  // Every wait is a poll that proceeds the instant the UI is ready (instead of a
  // fixed delay), so a single open/toggle/close cycle is as fast as Control Center
  // allows. The final read waits until exactly one option in the target group is
  // selected, which avoids acting on the brief unsettled state right after the
  // detail view appears.
  const script = `
set ToggleOption to "${toggleOption}"

on getOptionIndex(Opt)
	if Opt is equal to "주변음 허용" then
		return 2
	else if Opt is equal to "적응형" then
		return 3
	else if Opt is equal to "노이즈 캔슬링" then
		return 4
	else
		return 1
	end if
end getOptionIndex

-- Offsets/groups are relative to the AirPods output-device checkbox:
-- +1..+4 are the listening modes (끔/주변음 허용/적응형/노이즈 캔슬링),
-- +8/+9 are Conversation Awareness (Off/On).
if ToggleOption is "noise-control"
	set OptionOne to "${optionOne}"
	set OptionTwo to "${optionTwo}"

	set OffsetOne to getOptionIndex(OptionOne)
	set OffsetTwo to getOptionIndex(OptionTwo)
	set GroupStart to 1
	set GroupEnd to 4
else
	set OptionOne to "Off"
	set OptionTwo to "On"

	set OffsetOne to 8
	set OffsetTwo to 9
	set GroupStart to 8
	set GroupEnd to 9
end if

tell application "System Events"
	tell application process "ControlCenter"
		try
			set output to "🔴 No Change"

			-- Assumes the Control Center panel is closed to begin with.
			-- Open Control Center via its stable menu bar identifier
			set ccItem to missing value
			repeat with mbi in (menu bar items of menu bar 1)
				try
					if (value of attribute "AXIdentifier" of mbi) is "com.apple.menuextra.controlcenter" then
						set ccItem to mbi
						exit repeat
					end if
				end try
			end repeat

			if ccItem is missing value then
				return "sound-menu-not-found"
			end if

			click ccItem

			-- Wait for the volume module to appear
			set volEl to missing value
			repeat 200 times
				if (exists window 1) then
					repeat with e in (UI elements of group 1 of window 1)
						try
							if (value of attribute "AXIdentifier" of e) is "controlcenter-volume" then
								set volEl to e
								exit repeat
							end if
						end try
					end repeat
				end if
				if volEl is not missing value then exit repeat
				delay 0.01
			end repeat

			if volEl is missing value then
				if (exists window 1) then key code 53 -- ESC (only when the panel is open, so ESC never leaks to the frontmost app)
				return "sound-menu-not-found"
			end if

			-- Enter the Sound (volume) detail view via its "세부사항 보기" action
			set volActions to every action of volEl
			perform (item (count of volActions) of volActions)

			-- Wait for the detail scroll area and the AirPods output-device checkbox
			-- (all AirPods rows share the same AXIdentifier; the device row is first)
			set scrollArea to missing value
			set deviceIndex to 0
			repeat 200 times
				try
					set scrollArea to scroll area 1 of group 1 of window 1
					set allCheckboxes to checkboxes of scrollArea
					set deviceIndex to 0
					repeat with i from 1 to count of allCheckboxes
						try
							if ((value of attribute "AXIdentifier" of (item i of allCheckboxes)) as string) contains "AirPods" then
								set deviceIndex to i
								exit repeat
							end if
						end try
					end repeat
				end try
				if deviceIndex > 0 then exit repeat
				delay 0.01
			end repeat

			if deviceIndex is 0 then
				if (exists window 1) then key code 53 -- ESC (only when the panel is open, so ESC never leaks to the frontmost app)
				return "airpods-not-connected"
			end if

			-- Expand the AirPods row if it is collapsed so the mode checkboxes exist
			repeat with e in (UI elements of scrollArea)
				try
					if (role of e) is "AXDisclosureTriangle" and ((value of attribute "AXIdentifier" of e) as string) contains "AirPods" then
						if (value of e as integer) is 0 then click e
						exit repeat
					end if
				end try
			end repeat

			set IndexOne to deviceIndex + OffsetOne
			set IndexTwo to deviceIndex + OffsetTwo

			-- Wait until the target group is present and settled (exactly one selected)
			repeat 200 times
				if (count of checkboxes of scrollArea) >= (deviceIndex + GroupEnd) then
					set selectedCount to 0
					repeat with k from GroupStart to GroupEnd
						try
							set selectedCount to selectedCount + (value of checkbox (deviceIndex + k) of scrollArea as integer)
						end try
					end repeat
					if selectedCount is 1 then exit repeat
				end if
				delay 0.01
			end repeat

			if (count of checkboxes of scrollArea) < IndexTwo then
				if (exists window 1) then key code 53 -- ESC (only when the panel is open, so ESC never leaks to the frontmost app)
				return "airpods-not-connected"
			end if

			if ToggleOption is "noise-control" then
				-- Toggle between the two user-configured listening modes
				set currentModeOne to value of checkbox IndexOne of scrollArea as boolean

				if currentModeOne is true then
					click checkbox IndexTwo of scrollArea
					set output to "🟢 " & OptionTwo
				else
					click checkbox IndexOne of scrollArea
					set output to "🔵 " & OptionOne
				end if
			else
				-- Conversation Awareness toggle
				set isCAOff to value of checkbox IndexOne of scrollArea as boolean

				if isCAOff then
					click checkbox IndexTwo of scrollArea
					set output to "🟢 On"
				else
					click checkbox IndexOne of scrollArea
					set output to "🔵 Off"
				end if
			end if

			if (exists window 1) then key code 53 -- ESC (only when the panel is open, so ESC never leaks to the frontmost app)
			return output

		on error errMsg
			try
				if (exists window 1) then key code 53 -- ESC (only when the panel is open, so ESC never leaks to the frontmost app)
			end try
			return "sound-menu-not-found"
		end try
	end tell
end tell
  `;

  try {
    const result = await runAppleScript<string>(script);

    switch (result) {
      case "sound-menu-not-found": {
        await showFailureToast("", {
          title: "Could not open the Control Center Sound panel",
        });

        return null;
      }
      case "airpods-not-connected": {
        await showFailureToast("", { title: "AirPods not connected!" });

        return null;
      }
      default: {
        await updateCommandMetadata({ subtitle: `Mode: ${result}` });

        return result;
      }
    }
  } catch (error) {
    await showFailureToast(error, { title: "Could not run AppleScript" });

    return null;
  }
}

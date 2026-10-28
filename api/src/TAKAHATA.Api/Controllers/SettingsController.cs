using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TAKAHATA.Application.Common.Interface.Repositories;
using TAKAHATA.Application.Common.Interface.Services;
using TAKAHATA.Application.Services;
using TAKAHATA.Application.Settings.Commands;
using TAKAHATA.Domain.Common.Constant;

namespace TAKAHATA.Api.Controllers
{
    [Authorize(Roles = Role.Admin)]
    public class SettingsController : ApiController
    {
        private readonly ISender _sender;
        private readonly IPLCService _pLCService;
        private readonly IPLCSettingsService _pLCSettingsService;

        public SettingsController(
            ISender sender,
            IPLCSettingsService pLCSettingsService,
            IPLCService pLCService)
        {
            _sender = sender;
            _pLCSettingsService = pLCSettingsService;
            _pLCService = pLCService;
        }

        [HttpPost("update")]
        public async Task<IActionResult> Update(UpdateSettingsCommand request)
        {
            var result = await _sender.Send(request);

            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("query")]
        public async Task<IActionResult> Query()
        {
            var response = new
            {
                IpAddress = _pLCSettingsService.GetIpAddress(),
                Port = _pLCSettingsService.GetPort(),
            };

            return Ok(response);
        }

        [HttpPost("test-connection")]
        public async Task<IActionResult> TestConnection()
        {
            if (_pLCService.TestConnection())
                return Ok();

            return Problem();
        }

        [HttpPost("write-machine-bits")]
        public async Task<IActionResult> WriteMachineBits(WriteMachineBitsCommand request)
        {
            var result = await _sender.Send(request);

            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("read-machine-bits")]
        public async Task<IActionResult> ReadMachineBits(ReadMachineBitsCommand request)
        {
            var result = await _sender.Send(request);

            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }
    }
}
